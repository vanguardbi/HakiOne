require('dotenv').config();
const { buildHakiChain } = require('./server/services/HakiService');

async function testChain() {
  console.log('Testing Haki Chain...');
  try {
    const chain = await buildHakiChain();
    console.log('Chain built successfully.');

    const input = {
      question: 'What are my rights as a tenant?',
      chatHistory: '',
    };

    console.log('Invoking chain with input:', input);
    
    // We use .invoke() instead of .stream() for simple testing, 
    // but the service uses .stream(). Let's try invoke first.
    const response = await chain.invoke(input);
    console.log('✅ Chain Response:', response);

  } catch (error) {
    console.error('❌ Chain Error:', error);
    if (error.response) {
        console.error('Error Response Data:', error.response.data);
    }
  }
}

testChain();
