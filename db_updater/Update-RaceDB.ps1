<#
.DESCRIPTION 

Version 2.1

Added logic to handle events that need to be canceled (API events < DB events)...thanks Middle East

Added healthchecks.io monitoring! Check em out! 

This script is designed to go out and grab schedule data for indy, cup, imsa, and f1 race schedules. It will then connect to the local postgres container and compare
the desired data to that in the DB. If needed to be updated, then update

Requires SimplySql modules

Install-Module -Name SimplySql

Requires the Read-Secrets.ps1 to be dot source. Update path as needed! 
#>

. "$PSScriptRoot\Read-Secrets.ps1" -secretsFile "$PSScriptRoot\.secrets"
$healthUrl = $env:HEALTH_URL
function Write-Log { # logging function
    [CmdletBinding()]
    param (
        [string]$message,
        [ValidateSet("Info", "Warning", "Error")]
        [string]$Level = "Info",
        [switch]$writeToHost
    )

    $logPath = "$PSScriptRoot\db_updater.log"
    $date = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $message = "[$Level] - $date --> $message"

    Add-Content -Path $logPath -Value $message

    if($writeToHost) {
        Write-Host "$message"
    }  
}
function Get-APIScheduleData { # create a function to use on each serires to get the data. 
    param (
        [string]$seriesID, # users external series ID, not the DB internal one
        [string]$uri,
        [hashtable]$header
    )
    
    $year = (Get-Date).Year
    $uri = $uri + "/" + $seriesID + "/" + $year # build the complete uri from a base

    Write-Log "Calling API: $uri"

    try {
        $raw = Invoke-RestMethod -Uri $uri -Headers $header -Method Get # fetch the raw data
    } catch { # catch and log errors...exit script
        Write-Log "There was an error encounter trying to reach the api" -Level Error 
        Write-Log "ERROR: $($_.Exception)"
        Write-Log "Script exiting!"
        Invoke-WebRequest -Uri "$healthUrl/fail" -Method Post # send fail to healthcheck
        Exit 1
    }

    $events = $raw.schedule # traverse in one layer to get the events
    if ($seriesID -eq '4370') { # filter out the practice and qualifying events from the f1 json
        $events = $events | Where-Object {$_.strEvent -like "*Grand Prix" -or $_.strEvent -like "*Sprint"}
        $apiData = $events | ForEach-Object {
            [PSCustomObject]@{
                eventID = $_.idEvent
                eventName = $_.strEvent
                date = $_.dateEvent
                time = $_.strTime
                status = $_.strStatus
            }
        }
    } else {
        $apiData = $events | ForEach-Object {
            [PSCustomObject]@{
                eventID = $_.idEvent
                eventName = $_.strEvent
                date = $_.dateEvent
                time = $_.strTime
                status = $_.strStatus
            }
        }
    }
    Write-Log "Data retrieved for series $seriesID"
    Write-Log "There are $($apiData.Count) events to evaluate"
    return $apiData
    
}

function Get-DBScheduleData {
    param (
        [string]$seriesID # users internal DB ID; not external ID
    )

    try { # run sql query to grab all events for series
        $events = Invoke-SqlQuery -Query "SELECT * FROM events WHERE series_id=$seriesID"
    } catch {
        Write-Log "There was an error encountered trying to query database" -Level Error
        Write-Log "$_" -Level Error
        Invoke-WebRequest -Uri "$healthUrl/fail" -Method Post # send fail to healthcheck
        Exit 1
    }
    
    $dbData = $events | ForEach-Object { # build custom object of desired event data from DB
        [PSCustomObject]@{
            eventID = $_.external_event_id
            eventName = $_.event_name
            date = $_.event_date
            time = $_.event_time
            status = $_.event_status
        }
    }

    Write-Log "DB data for series $seriesID collected"
    Write-Log "There are $($dbData.Count) events to evaluate"
    return $dbData
    
}

Write-Log "%%%%%%%%%%%%%%%%%%Start of Script%%%%%%%%%%%%%%%%%%"

# set our db connection variables
$db = $env:POSTGRES_DB
$dbport = $env:DB_PORT
$dbuser = $env:POSTGRES_USER
$dbpwd = $env:POSTGRES_PASSWORD | ConvertTo-SecureString -AsPlainText -Force
$credential = [PScredential]::new($dbuser, $dbpwd) # creates a PSCredential [System.Management.Automation.PSCredential]

# connect to the DB 
try {
    Open-PostGreConnection -Server localhost -Database $db -Port $dbport -Credential $credential
    Start-Sleep -Seconds 1
    $connection = Get-SqlConnection

    if ($connection.State) {
        Write-Log "Successfully connected to $($connection.DataSource)"
    } else {
        Write-Log "There is an issues with the DB connection."
        Write-Log "Current connection state: $($connection.State)"
        Write-Log "Script will now exit"
        Invoke-WebRequest -Uri "$healthUrl/fail" -Method Post # send fail to healthcheck
        Exit 1
    }
} catch {
    Write-Log "There was an error encountered while connecting the database" -Level Error
    Write-Log "Script will now exit"
    Invoke-WebRequest -Uri "$healthUrl/fail" -Method Post # send fail to healthcheck
    Exit 1
}

$uri = "https://www.thesportsdb.com/api/v2/json/schedule/league"
$header = @{ # build header
    'X-API-KEY' = $env:X_API_KEY
}

# create a external serires id to internal series id mapping
$series_id_mappings = @(
    [PSCustomObject]@{ext_id = '4370'; int_id = '9'}
    [PSCustomObject]@{ext_id = '4373'; int_id = '6'}
    [PSCustomObject]@{ext_id = '4488'; int_id = '8'}
    [PSCustomObject]@{ext_id = '4393'; int_id = '7'}
)

# foreach series, run the check and update process
foreach ($series in $series_id_mappings) {

    Write-Log "Processing events for series: $($series.ext_id)/$($series.int_id)"

    # grab the API data
    $eventsAPI = Get-APIScheduleData -seriesID "$($series.ext_id)" -uri $uri -header $header

    # grab DB data
    $eventsDB = Get-DBScheduleData -seriesID "$($series.int_id)"

    # reset per-series collections so stale data from a prior iteration doesn't carry over
    $eventsToCancel = @()
    $eventsToAdd    = @()

    # check to see if the number of events lines up, check API against DB.
    if ($eventsDB.Count -ne $eventsAPI.Count) {
        if ($eventsAPI.Count -lt $eventsDB.Count) { # if DB events are greater, then mark events that need to be "canceled"
            Write-Log "The number of events in the DB are greater then the events from the API!" -Level Warning
            Write-Log "Marking extra DB events for removal"
            $eventsToCancel = $eventsDB | Where-Object {$_.eventID -notin $eventsAPI.eventID}
        } else { # if DB events are lower, then log it. Will add an event add bit. 
            Write-Log "The number of events in the DB is less then the events from the API!" -Level Warning
            Write-Log "Marking missing events from DB for addition"
            $eventsToAdd = $eventsAPI | Where-Object {$_.eventID -notin $eventsDB.eventID}
            Write-Log "Below are the events to add:"
            $eventsToAdd | ForEach-Object {Write-Log "$($_.eventName) needs added to DB"}
        }
    }
    
    $eventsToUpdate = @() # will hold any events needing update

    foreach ($eventAPI in $eventsAPI) { # run through each API event
        # grab the event in the DB with the same eventID (external_event_id)
        $eventDB = $eventsDB | Where-Object {$_.eventID -eq $eventAPI.eventID}

        if ($null -eq $eventDB) { # if there is no matching event in DB, then log and skip to the next event in API
            Write-Log "$($eventAPI.eventID) not found in DB!" -Level Warning
            continue
        }

        if ($eventDB.time -ne $eventAPI.time) { # if the time is differnt, then add to eventstoupdate
            Write-Log "The event $($eventAPI.eventName) time in the DB needs to be updated to $($eventAPI.time). The DB time was $($eventDB.time)"
            $eventsToUpdate += [PSCustomObject]@{
                eventID = $eventAPI.eventID
                eventName = $eventAPI.eventName
                newTime = $eventAPI.time
                newDate = $eventAPI.date

            }  
        }
    }

    # update event_status in DB for events that are canceled
    if ($eventsToCancel.Count -ne 0) {
        Write-Log "There are events to be canceled!"
        $eventsToCancel | ForEach-Object {
            try {
                if ($_.status -match "Canceled") {
                    Write-Log "$($_.eventName) status already $($_.status)...skiping DB update"
                } else {
                    Write-Log "Updating event_status to Canceled for $($_.eventName)"
                    Invoke-SqlQuery -Query "UPDATE events SET event_status='Canceled'
                    WHERE external_event_id=`'$($_.eventID)`'"
                }
            } catch {
                Write-Log "There was an error trying to update event_status for eventID: $($_.eventID)" -Level Error
                Write-Log "ERROR: $($_.Exception)" -Level Error
                Invoke-WebRequest -Uri "$healthUrl/log" -Method Post # send log to healthcheck
            }
        }
    }

    if ($eventsToUpdate.Count -eq 0) { # if no events to update, move on to the next series. 
        Write-Log "No events to update for series: $($series.ext_id)/$($series.int_id)"
        continue 
    }

    # run the update to DB 
    $eventsToUpdate | ForEach-Object {
        Write-Log "Updating $($_.eventName) w/ new time: $($_.newTime)"
        try {
            Invoke-SqlQuery -Query "UPDATE events SET event_time=`'$($_.newTime)`', event_date=`'$($_.newDate)`'
            WHERE external_event_id=`'$($_.eventID)`'"
        }
        catch {
            Write-Log "There was an error trying to update the DB for event: $($_.eventName)" -Level Error
            Write-Log "$($_.Exception)" -Level Error 
            Invoke-WebRequest -Uri "$healthUrl/log" -Method Post # send log to healthchec
        }
    }
}

Write-Log "All series has been processed"
Write-Log "Disconnecting from $db"
Close-SqlConnection

Invoke-WebRequest -Uri "$healthUrl" -Method Post # send success to healthchecks

Exit 


