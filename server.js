require('dotenv').config();
const express = require('express');
const {validate} = require('deep-email-validator');
const path = require('path');
const cors = require('cors');
const { MailtrapClient } = require('mailtrap');

const app = express();
const PORT = process.env.PORT || 3000;
const nodemailer = require('nodemailer') 


app.use(cors());
app.use(express.static('public'));
app.use(express.json());



app.get('/', (req,res) => {
    res.json({ message: 'CORS enabled!' });
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

async function verifyRecaptcha(token){
    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
    const recaptchaUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecret}&response=${token}`;

    const response = await fetch(recaptchaUrl, {method: 'POST'});
    const result = await response.json();

    return result.success;
}

app.post('/send-email', async (req, res) => {
    const {name, email, subject, message, 'g-recaptcha-response': recaptchaToken} = req.body;

    if(!name || !email || !subject || !message || !recaptchaToken) {
        return res.status(400).json({ status: 'error', message: 'Missing required fields!'})
    }

    const isRecaptchaValid = await verifyRecaptcha(recaptchaToken);
    if(!isRecaptchaValid){
        return res.status(400).json({
            status: 'error',
            message: 'reCaptcha verification failed. Please try again.'
        })
    }

    const validateResult = await validate(email);


    if(!validateResult.valid){
        return res.status(400).json({
            status: 'error',
            message: 'Email is not valid. Please try again',
            reason: validateResult.reason
        });
    }

    // if (!validateResult.valid) {
    //     console.log('Validation failed:', validateResult);
    //     return res.status(400).json({
    //       status: 'error',
    //       message: `Invalid email: ${validateResult.reason}`,
    //       details: validateResult.validators
    //     });
    //   }

    const client = new MailtrapClient({token: process.env.MAILTRAP_TOKEN});
    const sender = {name: 'NodeJS App', email: process.env.EMAIL_FROM};

    try {
        const response = await client.send({
            from: sender,
            to: [{email: process.env.EMAIL_TO}],
            subject: subject,
            text: `From ${name}\nEmail: ${email}\n\n${message}`,
        });

        console.log('Email sent: ', response.message_ids);
        res.status(200).json({
            status: 'success',
            message: 'Email sent successfuly'
        });
    } catch (error) {
        console.error('Error', error);
        res.status(500).json({ status: 'error', message: 'Failed to send email due to server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});