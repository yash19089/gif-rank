const AWS = require('aws-sdk');

// Configure your AWS credentials and region
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

// Function to check if SQS is reachable
const checkSQSReachable = async () => {
    try {
        await sqs.listQueues().promise();
        console.log('SQS is reachable and credentials are valid.');
    } catch (error) {
        console.error('Failed to reach SQS or invalid AWS credentials:', error);
        process.exit()
    }
};


module.exports = {
    sqs, checkSQSReachable
};