const express = require('express');
const axios = require('axios');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const total = new Map();

app.use(express.json());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html
app.get('/', (res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint to submit the request
app.post('/api/submit', async (req, res) => {
  const { cookie, url, amount, interval } = req.body;
  if (!cookie || !url || !amount || !interval) return res.status(400).json({
    error: 'Missing state, url, amount, or interval'
  });
  try {
    const cookies = await convertCookie(cookie);
    if (!cookies) {
      return res.status(400).json({
        status: 500,
        error: 'Invalid cookies'
      });
    }
    await share(cookies, url, amount, interval)
    res.status(200).json({
      status: 200
    });
  } catch (err) {
    return res.status(500).json({
      status: 500,
      error: err.message || err
    });
  }
});

// Get total process data
app.get('/total', (req, res) => {
  const data = Array.from(total.values()).map((link, index)  => ({
    session: index + 1,
    url: link.url,
    count: link.count,
    id: link.id,
    target: link.target,
  }));
  res.json(data);
});

// Share logic
async function share(cookies, url, amount, interval) {
  const id = await getPostID(url);
  const accessToken = await getAccessToken(cookies);
  if (!id) {
    throw new Error("Unable to get link id: invalid URL, it's either a private post or visible to friends only");
  }
  const postId = total.has(id) ? id + 1 : id;
  total.set(postId, {
    url,
    id,
    count: 0,
    target: amount,
  });
  
  const headers = {
    'accept': '*/*',
    'accept-encoding': 'gzip, deflate',
    'connection': 'keep-alive',
    'content-length': '0',
    'cookie': cookies,
    'host': 'graph.facebook.com'
  };

  let sharedCount = 0;
  let timer;

  async function sharePost() {
    try {
      const response = await axios.post(`https://graph.facebook.com/me/feed?link=https://m.facebook.com/${id}&published=0&access_token=${accessToken}`, {}, {
        headers
      });
      if (response.status !== 200) {
      } else {
        total.set(postId, {
          ...total.get(postId),
          count: total.get(postId).count + 1,
        });
        sharedCount++;
      }
      if (sharedCount === amount) {
        clearInterval(timer);
      }
    } catch (error) {
      clearInterval(timer);
      total.delete(postId);
    }
  }

  timer = setInterval(sharePost, interval * 1000);
  setTimeout(() => {
    clearInterval(timer);
    total.delete(postId);
  }, amount * interval * 1000);
}

// Additional functions (getPostID, getAccessToken, etc.) remain unchanged

app.listen(5000, () => {
  console.log('Server running on port 5000');
});
