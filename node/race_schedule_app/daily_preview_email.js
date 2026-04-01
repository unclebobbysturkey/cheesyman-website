// this script is desinged to run daily

require('dotenv').config(); // dotenv file
const transporter = require('./mail'); // import mail.js
const { Pool } = require('pg'); // import postgres module, place as an object Pool
const { images } = require('./cheese-images.js')

const pool = new Pool({ // setup the connection variables for the db
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

pool.connect((err, _, release) => { // test the DB connection
    if (err) {
        console.error(`Unable to connect to DB ${process.env.DB_NAME}: ${err.message}`);
    } else {
        console.log(`Succesfully connected to DB ${process.env.DB_NAME}`);
        release();
    }
});

async function getSeries() { // get series will grab all the series slugs and names.
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT slug, name FROM series'); // results always returned as array []
        return result.rows;  // fix #3: return inside try, where result is in scope
    } catch (err) {
        console.error(`Error querying database ${process.env.DB_NAME}:`, err.message);
        throw err; // terminates script. Would be logged in the Docker logs. 
    } finally {
        client.release();
        console.log(`Released connection to ${process.env.DB_NAME}`);
    }
}
// gets today's schedule for the series slug
async function getDailySchedule (slug, today_date) { 
    const client = await pool.connect();
    const query = `
                    SELECT
            e.event_date,
            e.event_date_end,
            e.event_name,
            e.event_time,
            e.external_event_id,
            t.surface,
            t.type,
            t.name AS track_name,
            t.city,
            t.state,
            t.country,
            t.size
        FROM events e
        JOIN series s ON e.series_id = s.id
        LEFT JOIN tracks t ON e.track_id = t.id
        WHERE s.slug = $1
            AND e.event_date = $2`
    try {
        const result = await client.query(query, [slug, today_date]); // make the query
        return result.rows
    } catch (err) {
        console.error(`Error connecting/querying database ${process.env.DB_NAME}:`, err.message);
    } finally {
        client.release();
        console.log(`Released connection to ${process.env.DB_NAME}`);
    }
}

function getDailyCheese() { // grab a random cheese
    const randomIndex = Math.floor(Math.random() * images.length);
    return images[randomIndex];
}

async function sendDailyPreview() {
    const today = new Date();
    const today_date = today.toISOString().split('T')[0];

    const seriesList = await getSeries();

    const url = getDailyCheese();


    let htmlBody = `
        <h2 style="font-family:sans-serif;">Daily Race Preview w/ Cheese!</h2>
        <p style="font-family:sans-serif;">Today is ${today_date}</p>
        <hr>
    `;

    for (const { slug, name } of seriesList) {
        const events = await getDailySchedule(slug, today_date);

        htmlBody += `<h3 style="font-family:sans-serif;">${name}</h3>`;

        if (!events || events.length === 0) {
            htmlBody += `<p style="font-family:sans-serif;"><em>No events today.</em></p>`;
        } else {
            htmlBody += `
            <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-family:sans-serif; font-size:14px;">
                <thead style="background-color:#f2f2f2;">
                    <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Event</th>
                        <th>Track</th>
                        <th>Location</th>
                        <th>Type</th>
                    </tr>
                </thead>
                <tbody>`;

            for (const e of events) {
                const date = e.event_date
                    ? new Date(e.event_date).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
                    : '&mdash;';
                const time = e.event_time || '&mdash;';
                const eventName = e.event_name || '&mdash;';
                const track = e.track_name || '&mdash;';
                const location = [e.city, e.state, e.country].filter(Boolean).join(', ') || '&mdash;';
                const type = e.type || '&mdash;';

                htmlBody += `
                    <tr>
                        <td>${date}</td>
                        <td>${time}</td>
                        <td>${eventName}</td>
                        <td>${track}</td>
                        <td>${location}</td>
                        <td>${type}</td>
                    </tr>`;
            }

            htmlBody += `</tbody></table>`;
        }

        htmlBody += `<br>`;

    }         
        htmlBody += `
            <h2>Now...the Cheese!!!</h2>
            <img src="${url}" alt="Daily Cheese" style="width:300px; border-radius:10px; margin-bottom:16px;">
            `;

    const mailOptions = {
        from: 'cheesyman.mail@gmail.com',
        to: process.env.EMAIL_TO,
        bcc: process.env.EMAIL_BCC,     // comma-separated string in .env
        subject: `The Daily Cheese ${today_date}`,
        html: htmlBody
    };

    await transporter.sendMail(mailOptions);
    console.log(`Daily schedule and cheese email for ${today_date} has been sent.`);
}

sendDailyPreview()
                .then(() => pool.end())
                .catch(err => {
                    console.error('Error sending daily schedule email:', err.message);
                    pool.end();
                    process.exit(1);
                });