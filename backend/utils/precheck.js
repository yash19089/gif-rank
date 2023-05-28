const fs = require('fs');
const {sequelize, Proxy} = require('./sequelize');
const {checkSQSReachable} = require("./aws");
const run = () => {
    // Synchronize the models with the database
    sequelize.sync()
        .then(() => {
            console.log('Tables synchronized');
        }).then(() => {
        // Check if the Proxy table is empty
        Proxy.count()
            .then((count) => {
                if (count === 0) {
                    // Read proxies from the default_proxies.txt file
                    fs.readFile('default_proxies.txt', 'utf8', (err, data) => {
                        if (err) {
                            console.error('Failed to read default_proxies.txt:', err);
                            process.exit();
                            return;
                        }

                        // Split the file content into individual proxies
                        const proxies = data.trim().split('\n');

                        // Create an array to store the proxy objects
                        const proxyObjects = [];

                        // Process each proxy
                        for (const proxy of proxies) {
                            const [ip, port, username, password] = proxy.split(':');
                            proxyObjects.push({ ip, port, username, password });
                        }

                        // Bulk insert the proxy objects into the Proxy table
                        Proxy.bulkCreate(proxyObjects)
                            .then(() => {
                                console.log('Proxy table populated');
                            })
                            .catch((insertErr) => {
                                console.error('Failed to populate Proxy table:', insertErr);
                                process.exit();
                            });
                    });
                }
            })
            .catch((countErr) => {
                console.error('Failed to check Proxy table count:', countErr);
                process.exit();
            });
    })
        .catch((err) => {
            console.error('Failed to synchronize tables:', err);
            process.exit();
        });

    checkSQSReachable();
}

module.exports = {
    runPreChecks: run
}



