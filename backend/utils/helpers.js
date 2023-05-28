const crypto = require('crypto');
const {Task} = require("./sequelize");
const {sqs} = require("./aws");
const { Op, Sequelize} = require('sequelize');

// Generate batch ID using IP, time, and random number
const generateBatchId = (ip) => {
    const timestamp = Date.now();
    const random = Math.random();

    const batchIdString = `${ip}${timestamp}${random}`;

    // Convert batch ID string to MD5 hash
    return crypto.createHash('md5').update(batchIdString).digest('hex');
};


// Function to pick up tasks and send them to the AWS queue
const sendTasksToQueue = async () => {
    try {
        const tasks = await Task.findAll({
            where: {
                isPossible: true,
                inQueue: false,
                isProcessing: false,
                currentCount: { [Op.lt]: Sequelize.col('targetCount') },
            },
            limit: 10,
        });

        if (tasks.length > 0) {
            const queueUrl = process.env.SQS_QUEUE_URL;

            console.log(queueUrl);

            const entries = tasks.map((task) => {
                return {
                    Id: task.id.toString(),
                    MessageBody: JSON.stringify(task),
                };
            });

            if(entries.length === 0) {
                return;
            }

            const sendMessageParams = {
                Entries: entries,
                QueueUrl: queueUrl,
            };

            // Send the tasks to the AWS queue
            await sqs.sendMessageBatch(sendMessageParams).promise();

            // Update the tasks' isQueue flag to true
            await Task.update({ inQueue: true }, { where: { id: tasks.map((task) => task.id) } });
            console.log(`Pushed ${tasks.length} tasks to queue`);
        }
    } catch (error) {
        console.error('Failed to send tasks to the AWS queue:', error);
    }
};

module.exports = {
    generateBatchId,
    sendTasksToQueue
};
