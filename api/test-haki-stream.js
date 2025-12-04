require('dotenv').config();
const { buildHakiChain } = require('./server/services/HakiService');

async function testHakiStream() {
  console.log('Testing Haki Chain Streaming...');
  try {
    const chain = await buildHakiChain();
    console.log('Chain built successfully.');

    const input = {
      question: 'What are my rights as a tenant?',
      chatHistory: '',
    };

    console.log('Starting stream with input:', input);
    
    const stream = await chain.stream(input);
    
    console.log('Stream started. Receiving chunks...');
    let fullResponse = '';
    let chunkCount = 0;

    for await (const chunk of stream) {
        process.stdout.write(chunk); // Print chunk as it arrives
        fullResponse += chunk;
        chunkCount++;
    }

    console.log('\n\n✅ Stream finished.');
    console.log(`Total chunks: ${chunkCount}`);
    console.log(`Full response length: ${fullResponse.length}`);

  } catch (error) {
    console.error('\n❌ Stream Error:', error);
    if (error.response) {
        console.error('Error Response Data:', error.response.data);
    }
  }
}

testHakiStream();
