const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const app = express();
app.use(bodyParser.json());

const SHEET_ID = 'あなたのスプレッドシートID';
const GOOGLE_SERVICE_ACCOUNT_EMAIL = 'xxx@xxx.iam.gserviceaccount.com';
const GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n';

app.post('/webhook', async (req, res) => {
  const { customer_id, title, content } = req.body;

  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  const user = rows.find(row => row.customer_id === customer_id);

  if (!user) return res.status(404).send('Customer not found');

  const auth = Buffer.from(`${user.wp_user}:${user.wp_app_pass}`).toString('base64');

  try {
    await axios.post(`${user.wp_url}/wp-json/wp/v2/posts`, {
      title,
      content,
      status: 'publish'
    }, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).send('Posted to WordPress');
  } catch (e) {
    console.error(e);
    res.status(500).send('Post failed');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
