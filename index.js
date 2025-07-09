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
        const worksCollection = db.collection('works');


        // app.get('/peoples', async (req, res) => {
        //     const peoples = await peoplesCollection.find().toArray();
        //     res.send(peoples);
        // });




        // registered User post data 
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

        // to see work entry
        app.get('/works', async (req, res) => {
            try {
                const email = req.query.email;
                const query = email ? { email } : {};
                const works = await worksCollection.find(query).sort({ date: -1 }).toArray();
                res.send(works);
            } catch (err) {
                res.status(500).send({ error: 'Failed to fetch works' });
            }
        });


        //  POST a new work entry
        app.post('/works', async (req, res) => {
            try {
                const work = req.body;
                work.createdAt = new Date();
                const result = await worksCollection.insertOne(work);
                res.send(result);
            } catch (err) {
                res.status(500).send({ error: 'Failed to add work' });
            }
        });

        // ✅ PATCH to update a work item
        app.patch('/works/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const update = req.body;
                const result = await worksCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: update }
                );
                res.send(result);
            } catch (err) {
                res.status(500).send({ error: 'Failed to update work' });
            }
        });

        // ✅ DELETE a work item
        app.delete('/works/:id', async (req, res) => {
            try {
                const id = req.params.id;
                const result = await worksCollection.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (err) {
                res.status(500).send({ error: 'Failed to delete work' });
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