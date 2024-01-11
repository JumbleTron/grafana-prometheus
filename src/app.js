import express from "express";
import pino from "pino";
import expressPino from 'express-pino-logger';
import promClient from 'prom-client';

const PORT = process.env.PORT || 5555;

const logger = pino({ level:process.env.LOG_LEVEL || 'debug' })
const expressLogger = expressPino({logger});

const app = express()
app.use(express.json(), expressLogger);

const register = new promClient.Registry()
promClient.collectDefaultMetrics({ register });

const Histogram = promClient.Histogram;
const Counter = promClient.Counter;
const requestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'request duration histogram',
    labelNames: ['handler' , 'method', 'statuscode'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});
const orderCounter = new Counter({ name: 'orders_total', 'help': 'Total of orders' })

register.registerMetric(requestDuration)
register.registerMetric(orderCounter)

const profilerMiddleware = (req, res, next) => {
    if (['/metrics', '/health'].includes(req.url)) {
        next();
        return;
    }
    const end = requestDuration.startTimer()
    res.once('finish', () => {
        const duration = end({ handler:req.url, method: req.method, statuscode: res.statusCode });
        logger.info('Duration  %d', duration);
    });

    next();
};
app.use(profilerMiddleware);

app.listen(PORT, () => {
    console.log(`Example app listening on port ${PORT}`)
})

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.post('/orders', (req, res) => {
    orderCounter.inc(1);
    res.send('Orders saved');
})

app.get('/users', (req, res) => {
    try {
        throw new Error('An uncaught exception!')
    } catch (e) {
        logger.error(e, 'Internal server error')
        return res.status(500).send({ error: e.message });
    }
})

app.get('/health', (req, res) => {
    logger.debug('Calling res.send');
    return res.status(200).send({message: "Health is good"});
});

app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (ex) {
        res.status(500).end(ex);
    }
});