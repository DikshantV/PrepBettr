const { QueueServiceClient } = require('@azure/storage-queue');
const { DefaultAzureCredential } = require('@azure/identity');

class QueueService {
    constructor() {
        this.queueServiceClient = null;
        this.queues = {
            SEARCH_JOBS: 'search-jobs',
            PROCESS_APPLICATIONS: 'process-applications',
            FOLLOW_UP_REMINDERS: 'follow-up-reminders',
            AUTOMATION_LOGS: 'automation-logs'
        };
    }

    async initialize() {
        if (this.queueServiceClient) {
            return;
        }

        const connectionString = process.env.AzureWebJobsStorage;
        if (!connectionString) {
            throw new Error('AzureWebJobsStorage connection string is required');
        }

        this.queueServiceClient = QueueServiceClient.fromConnectionString(connectionString);

        // Create queues if they don't exist
        for (const queueName of Object.values(this.queues)) {
            try {
                const queueClient = this.queueServiceClient.getQueueClient(queueName);
                await queueClient.createIfNotExists();
                console.log(`Queue ${queueName} is ready`);
            } catch (error) {
                console.error(`Error creating queue ${queueName}:`, error);
            }
        }
    }

    async addMessage(queueName, message, options = {}) {
        if (!this.queueServiceClient) {
            await this.initialize();
        }

        const queueClient = this.queueServiceClient.getQueueClient(queueName);
        const messageText = typeof message === 'string' ? message : JSON.stringify(message);
        
        const base64Message = Buffer.from(messageText).toString('base64');
        
        return await queueClient.sendMessage(base64Message, {
            visibilityTimeoutInSeconds: options.visibilityTimeout || 0,
            messageTimeToLiveInSeconds: options.timeToLive || 604800 // 7 days default
        });
    }

    async receiveMessages(queueName, options = {}) {
        if (!this.queueServiceClient) {
            await this.initialize();
        }

        const queueClient = this.queueServiceClient.getQueueClient(queueName);
        const response = await queueClient.receiveMessages({
            numberOfMessages: options.numberOfMessages || 1,
            visibilityTimeoutInSeconds: options.visibilityTimeout || 30
        });

        return response.receivedMessageItems.map(item => ({
            id: item.messageId,
            popReceipt: item.popReceipt,
            dequeueCount: item.dequeueCount,
            data: JSON.parse(Buffer.from(item.messageText, 'base64').toString()),
            insertionTime: item.insertionTime,
            expirationTime: item.expirationTime,
            timeNextVisible: item.timeNextVisible
        }));
    }

    async deleteMessage(queueName, messageId, popReceipt) {
        if (!this.queueServiceClient) {
            await this.initialize();
        }

        const queueClient = this.queueServiceClient.getQueueClient(queueName);
        return await queueClient.deleteMessage(messageId, popReceipt);
    }

    async updateMessage(queueName, messageId, popReceipt, message, visibilityTimeout = 0) {
        if (!this.queueServiceClient) {
            await this.initialize();
        }

        const queueClient = this.queueServiceClient.getQueueClient(queueName);
        const messageText = typeof message === 'string' ? message : JSON.stringify(message);
        const base64Message = Buffer.from(messageText).toString('base64');
        
        return await queueClient.updateMessage(messageId, popReceipt, base64Message, visibilityTimeout);
    }

    async getQueueLength(queueName) {
        if (!this.queueServiceClient) {
            await this.initialize();
        }

        const queueClient = this.queueServiceClient.getQueueClient(queueName);
        const properties = await queueClient.getProperties();
        return properties.approximateMessagesCount;
    }
}

module.exports = new QueueService();
