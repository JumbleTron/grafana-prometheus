import express from "express";
import { AggregatorRegistry, Counter } from "prom-client";
import * as cluster from "cluster";

const metricsServer = express()
const server = express();
const aggregatorRegistry = new AggregatorRegistry();
const ordersCounter = new Counter({
    name: 'orders_total',
    help: 'Total of orders',
});

if (cluster.isPrimary) {
    console.log('------ Master')
    for (let i = 0; i < 4; i++) {
        cluster.fork();
    }

    metricsServer.get('/metrics', async (req, res) => {
        try {
            const metrics = await aggregatorRegistry.clusterMetrics();
            res.set('Content-Type', aggregatorRegistry.contentType);
            res.send(metrics);
        } catch (ex) {
            res.statusCode = 500;
            res.send(ex.message);
        }
    });

    metricsServer.listen(5005);
    console.log(
        'Cluster metrics server listening to 5005, metrics exposed on /cluster_metrics',
    );
} else {
    console.log('========= Slave')
    const port = process.env.PORT || 5555;
    console.log(
        `Server listening to ${port}, metrics exposed on /metrics endpoint`,
    );
    server.listen(port);

    server.post('/orders', (req, res) => {
        ordersCounter.inc(1);
        res.send('Orders saved');
    })
}