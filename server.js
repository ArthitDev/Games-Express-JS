const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');
require('dotenv').config()



const app = express();
app.use(bodyParser.json());



const connection = mysql.createConnection(process.env.DATABASE_URL)
app.use(cors());



app.get('/games', (req, res) => {
    const updateSql = "UPDATE games SET score = (SELECT AVG(vote) FROM games_comments WHERE games_comments.game_id = games.game_id) WHERE EXISTS (SELECT 1 FROM games_comments WHERE games_comments.game_id = games.game_id)";
    connection.query(updateSql, (updateErr, updateResults) => {
        if (updateErr) {
            console.error(updateErr);
            return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
        }

        let sql;
        if (req.query.game_id) {
            const game_id = req.query.game_id;
            sql = "SELECT * FROM games WHERE game_id = ?";
            connection.query(sql, [game_id], (err, games) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
                }

                processComments(games, res);
            });
        } else {
            sql = "SELECT * FROM games";
            connection.query(sql, (err, games) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
                }

                processComments(games, res);
            });
        }
    });
});

function processComments(games, res) {
    const results = [];

    function processGame(index) {
        if (index === games.length) {
            if (results.length === 0) {
                return res.status(404).json({ status: 'ข้อผิดพลาด', message: 'ไม่พบข้อมูลสำหรับ game_id ที่ระบุ' });
            }

            res.json(results);
            return;
        }
        const game = games[index];
        const game_id = game.game_id;
        const sqlcomment = "SELECT * FROM games_comments WHERE game_id = ?";
        connection.query(sqlcomment, [game_id], (err, comments) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ status: 'error', message: 'Internal Server Error' });
            }
            const comment_arr = comments.map(comment => ({
                comment_id: comment.comment_id,
                comment_text: comment.comment,
                vote: comment.vote,
                username_text: comment.username
            }));

            game.comment = comment_arr;
            results.push(game);

            processGame(index + 1);
        });
    }

    processGame(0);
}

app.post('/games', (req, res) => {
    const { game_name, game_description, img, game_type, game_id, comment, vote } = req.body;

    if (game_id !== undefined) {
        const commentSql = "INSERT INTO games_comments (game_id, comment, vote) VALUES (?, ?, ?)";
        connection.query(commentSql, [game_id, comment, vote], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ status: 'error', message: 'Error inserting comment data' });
            }

            res.json({ status: 'success', message: 'Comment data inserted successfully' });
        });
    } else {
        // It's a new game insertion
        const gameSql = "INSERT INTO games (game_name, game_description, img, game_type) VALUES (?, ?, ?, ?)";
        connection.query(gameSql, [game_name, game_description, img, game_type], (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ status: 'error', message: 'Error inserting Game data' });
            }

            res.json({ status: 'success', message: 'Game data inserted successfully' });
        });
    }
});


app.put('/games/:game_id', (req, res) => {
    const { game_id, game_name, game_description, img, game_type } = req.body;
    const sql = "UPDATE games SET game_name=?, game_description=?, img=?, game_type=? WHERE game_id=?";
    connection.query(sql, [game_name, game_description, img, game_type, game_id], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ status: 'error', message: 'Error updating record' });
        }

        res.json({ status: 'success', message: 'Record updated successfully' });
    });
});

app.delete('/games/:game_id', (req, res) => {
    const game_id = req.params.game_id;
    const sql = "DELETE FROM games WHERE game_id = ?";
    connection.query(sql, [game_id], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ status: 'error', message: 'Error deleting record' });
        }

        res.json({ status: 'success', message: 'Record deleted successfully' });
    });
});

app.listen(process.env.PORT || 3000);
