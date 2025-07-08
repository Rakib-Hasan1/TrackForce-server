const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require('mongodb');
const dotenv = require("dotenv");

dotenv.config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.xyujo4m.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db('employeeManagement');
        const peoplesCollection = db.collection('peoples');


        app.get('/peoples', async (req, res) => {
            const peoples = await peoplesCollection.find().toArray();
            res.send(peoples);
        });
        

        app.post('/peoples', async (req, res) => {
            try {
                const newPeople = req.body;
                const result = await peoplesCollection.insertOne(newPeople);
                res.send(result);
            }
            catch (error) {
                console.error('Error inserting People', error);
                res.status(500).send({ message: 'Failed to create People' });
            }
        });




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("TrackForce server is running ✅");
});


app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});