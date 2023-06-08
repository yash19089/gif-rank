const Sequelize = require("sequelize");
const {DataTypes} = require("sequelize");

// Read credentials from .env file
require('dotenv').config();

// Create Sequelize instance
const sequelize = new Sequelize(process.env.MYSQL_DATABASE, process.env.MYSQL_USERNAME, process.env.MYSQL_PASSWORD, {
    host: process.env.MYSQL_HOST,
    dialect: 'mysql',
    dialectOptions: {
        connectTimeout: 30000
    }
});

// Configure logging
sequelize.options.logging = (logMessage) => {
    // Check log level
    if (logMessage.includes('WARNING') || logMessage.includes('ERROR')) {
        console.log(logMessage); // Log the error or warning
    }
};

// Test the database connection
sequelize.authenticate()
    .then(() => {
        console.log('Connected to MySQL database');
    })
    .catch((err) => {
        console.error('Failed to connect to MySQL database:', err);
        process.exit()
    });


const Proxy = sequelize.define('Proxy', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    ip: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    port: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    isInactive: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: 0
    }
}, {
    timestamps: true,
});

// Define the Task table model
const Task = sequelize.define('Task', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    tagName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    gifId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    batchId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    inQueue: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    isProcessing: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    targetCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    currentCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    isPossible: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    }
}, {
    timestamps: true,
    indexes: [
        // Index on the `isPossible` column
        {
            fields: ['isPossible'],
            name: 'idx_isPossible'
        },
        // Composite index on `(tagName, batchId)`
        {
            fields: ['tagName', 'batchId'],
            name: 'idx_tagName_batchId'
        }
    ]
});

// Define the History table model
const History = sequelize.define('History', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    tagName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    gifId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    position: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
}, {
    timestamps: true,
});

module.exports = {
    sequelize,
    Proxy,
    Task,
    History,
}