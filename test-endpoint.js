const axios = require('axios');

async function testEndpoint() {
  try {
    console.log('Testing Haki endpoint...');
    const response = await axios.post(
      'http://localhost:3080/api/haki/chat/completions',
      {
        model: 'haki-legal',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false
      },
      {
        headers: {
          'Authorization': 'Bearer dev-haki-key',
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error testing endpoint:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testEndpoint();
