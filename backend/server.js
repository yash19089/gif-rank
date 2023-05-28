const express = require('express');
const { Task } = require('./utils/sequelize');
const {runPreChecks} = require('./utils/precheck');
const {generateBatchId, sendTasksToQueue} = require('./utils/helpers')
const cors = require('cors');
const axios = require("axios");
const {Sequelize} = require("sequelize");

runPreChecks();

const app = express();
app.use(cors());
app.use(express.json());

// Route to handle bulk task creation
app.post('/bulk-tasks', (req, res) => {
    const { body } = req;

    // Check if the request body is in the expected format
    if (typeof body !== 'object' || body === null) {
        return res.status(400).json({ error: 'Invalid request format' });
    }

    const bulkTasks = [];
    const batchId = generateBatchId();

    // Process each tagName and its tasks
    for (const tagName in body) {
        if (Object.prototype.hasOwnProperty.call(body, tagName)) {
            const gifObject = body[tagName];


            // Check if the GIF object is in the expected format
            if (typeof gifObject !== 'object' || gifObject === null) {
                return res.status(400).json({ error: `Invalid GIF object format for tag: ${tagName}` });
            }

            // Process each GIF ID and target count within the GIF object
            for (const gifId in gifObject) {
                if (gifObject.hasOwnProperty(gifId)) {
                    const targetCount = Number(gifObject[gifId]);

                    // Validate the task data
                    if (!gifId || typeof gifId !== 'string' || !targetCount || typeof targetCount !== 'number') {
                        return res.status(400).json({ error: `Invalid task data for tag: ${tagName}` });
                    }

                    // Create a task object and add it to the bulk tasks array
                    bulkTasks.push({
                        tagName,
                        batchId,
                        gifId,
                        targetCount,
                    });
                }
            }
        }
    }

    // Perform bulk insertion of tasks into the Task table
    Task.bulkCreate(bulkTasks)
        .then(() => {
            return res.status(201).json({ message: 'Bulk tasks created successfully' });
        })
        .catch((error) => {
            console.error('Failed to create bulk tasks:', error);
            return res.status(500).json({ error: 'Failed to create bulk tasks' });
        });
});

app.get('/feed', async (req, res) => {
    try {
        const { channelId } = req.query;

        if (!channelId) {
            return res.status(400).json({ error: 'Missing required parameter: channelId' });
        }

        const offset = req.query.offset || 0;

        const url = `https://giphy.com/api/v4/channels/${channelId}/feed/?offset=${offset}`;

        let data = null;

        try {
            const response = await axios.get(url);
            data = response.data;
        } catch (e) {
            if(e.response.status === 500){
               data = {
                   next: `https://giphy.com/api/v4/channels/${channelId}/feed/?offset=${Number(offset) + 25}`,
                   count: null,
                   skip: true,
                   previous: null,
                   results: []
               };
            }
        }

        res.json(data);

    } catch (error) {
        console.error('Failed to fetch feed:', error);
        res.status(500).json({ error: 'Failed to fetch feed' });
    }
});

app.get('/progress', async (req, res) => {
    try {
        const progressData = await Task.findAll({
            attributes: [
                'tagName',
                'batchId',
                [
                    Sequelize.fn('SUM', Sequelize.literal('CASE WHEN isPossible = 1 THEN currentCount ELSE 0 END')),
                    'currentCount'
                ],
                [
                    Sequelize.fn('SUM', Sequelize.literal('CASE WHEN isPossible = 1 THEN targetCount ELSE 0 END')),
                    'possibleTargetCount'
                ],
                [
                    Sequelize.fn('SUM', Sequelize.literal('CASE WHEN isPossible = 0 THEN targetCount ELSE 0 END')),
                    'impossibleTargetCount'
                ],
               'createdAt'
            ],
            group: ['tagName', 'batchId'],
        });

        res.json(progressData);
    } catch (error) {
        console.error('Error retrieving progress data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start the Express server
app.listen(3000, () => {
    console.log('Server listening on port 3000');
    setInterval(sendTasksToQueue, 10000); // Runs every 30 seconds
});
