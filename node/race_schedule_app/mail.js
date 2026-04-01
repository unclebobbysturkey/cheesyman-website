// this setups up the transporter for sending mail.
// scripts that need to send mail import this. 
// requires nodemailer...npm install nodemailer
// requires dotenv

const nodemailer = require("nodemailer"); // bring in nodemailer module
require('dotenv').config(); // brings in dotenv module
// create the transporter (the mail truck lol)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PWD, // The 16-character App Password
  },
});

module.exports = transporter; // export as module




