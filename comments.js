// Create web server application

// Import modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { randomBytes } = require('crypto');
const axios = require('axios');

// Create express application
const app = express();

// Use middlewares
app.use(bodyParser.json());
app.use(cors());

// Create comments object
const commentsByPostId = {};

// Create routes
app.get('/posts/:id/comments', (req, res) => {
    res.send(commentsByPostId[req.params.id] || []);
});

app.post('/posts/:id/comments', async (req, res) => {
    // Generate random id for comment
    const commentId = randomBytes(4).toString('hex');

    // Get comment data from request
    const { content } = req.body;

    // Get comments for post
    const comments = commentsByPostId[req.params.id] || [];

    // Add new comment to comments
    comments.push({ id: commentId, content, status: 'pending' });

    // Save comments
    commentsByPostId[req.params.id] = comments;

    // Send event to event bus
    await axios.post('http://event-bus-clusterip-srv:4005/events', {
        type: 'CommentCreated',
        data: {
            id: commentId,
            content,
            postId: req.params.id,
            status: 'pending'
        }
    });

    // Send response
    res.status(201).send(comments);
});

app.post('/events', async (req, res) => {
    console.log('Received Event', req.body.type);

    const { type, data } = req.body;

    if (type === 'CommentModerated') {
        const { id, postId, content, status } = data;

        // Get comments for post
        const comments = commentsByPostId[postId];

        // Find comment by id
        const comment = comments.find(comment => {
            return comment.id === id;
        });

        // Update comment status
        comment.status = status;

        // Send event to event bus
        await axios.post('http://event-bus-clusterip-srv:4005/events', {
            type: 'CommentUpdated',
            data: {
                id,
                postId,
                content,
                status
            }
        });
    }

    // Send response
    res.send({});
});

// Listen