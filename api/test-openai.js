require('dotenv').config();
const { ChatOpenAI } = require('@langchain/openai');

async function testConnection() {
  console.log('Testing OpenAI Connection...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is missing from environment variables.');
    return;
  }

  console.log('API Key found (length):', process.env.OPENAI_API_KEY.length);

  try {
    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o', 
      temperature: 0.1,
    });

    console.log('Sending request to gpt-4o...');
    const response = await model.invoke('Hello, are you working?');
    console.log('✅ Response received:', response.content);
  } catch (error) {
    console.error('❌ Error connecting to OpenAI:', error);
  }
}

testConnection();
