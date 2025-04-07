// 必要なライブラリを読み込み
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());

// 認証用のJSONファイルを読み込む（Renderでは環境変数で管理が望ましい）
const KEYFILEPATH = 'credentials.json'; // .jsonファイル名に合わせて変更
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

// スプレッドシートID（URLから抜き出したやつ）
const SPREADSHEET_ID = '1UotmIXch1sdyhHpSxwx7yNCDorhrg6zDMJwYCqZ-Kgk';
const SHEET_NAME = 'シート1';

// Webhookの受け口
app.post('/webhook', async (req, res) => {
  const { customer_id, title, content } = req.body;
  if (!customer_id || !title || !content) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Google Sheets API認証
    const auth = new google.auth.GoogleAuth({
      keyFile: KEYFILEPATH,
      scopes: SCOPES
    });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // シートの内容を読み込む
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:D`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No data found in sheet' });
    }

    // customer_id で一致する行を探す
    const match = rows.find(row => row[0] === customer_id);
    if (!match) {
      return res.status(404).json({ error: 'Customer ID not found' });
    }

    const [_, wp_url, wp_user, wp_app_pass] = match;
    const authToken = Buffer.from(`${wp_user}:${wp_app_pass}`).toString('base64');

    // WordPressへ投稿
    const wpResponse = await axios.post(
      `${wp_url}/wp-json/wp/v2/posts`,
      {
        title: title,
        content: content,
        status: 'publish'
      },
      {
        headers: {
          'Authorization': `Basic ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return res.status(200).json({ message: 'Post published', postId: wpResponse.data.id });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
