const express = require('express');
const app = require('express')();
const mysql = require('mysql');
const http = require('http').Server(app);
const io = require('socket.io')(http);

const PORT = 3000;
const HOST = 'localhost';

const db = mysql.createConnection({
    host        :   'taksindbinstance.czv8vo5bfekg.ap-southeast-1.rds.amazonaws.com',
    user        :   'aonrobot',
    password    :   'AONBOtBOt.cpp',
    database    :   'taksinmath'
});

db.connect((err) => {
    if(err){
        throw err;
    }
    console.log('MySQL Connected ....')
});

var students = [];
var isGameStart = false;

app.use(express.static('public'));

app.get('/', function(req, res) {
   res.sendfile('index.html');
});

app.get('/teacher', function(req, res) {
    res.sendfile('teacher.html');
});

app.get('/startGame', function(req, res) {

    console.log('The game now playing...')

    if(students.length < 2){
        io.of('/teacher').emit('message', {message : 'Please wait student at least 2 people'})
    }else{

        isGameStart = true;
        io.of('/student').emit('gameStatus', {status : 'playing'})
        io.of('/teacher').emit('gameStatus', {status : 'playing'})

        let studentsLength = students.length
        let numberList = []
        while(numberList.length < studentsLength){
            let randomNum = Math.floor((Math.random() * studentsLength));
            if(numberList.indexOf(randomNum) < 0) numberList.push(randomNum)
        }

        console.log(students);

        db.query("SELECT * FROM taksinmath.problems ORDER BY problem_group, problem_pair", function (err, result, fields) {
            if (err) throw err;
            let i = 0;
            for(let index of numberList){
                let student_id = students[index].id; // .substring(9)
                //console.log('send to -> ', student_id , ' problem -> ', result[i])
                io.of('/student').to(student_id).emit('problem', {problem : result[i]});
                i++
            }
        });
        
        res.json({status : 'playing'});
    }
});
app.get('/stopGame', function(req, res) {

    console.log('The game now stoped...')

    students = [];
    isGameStart = false;

    io.of('/student').emit('gameStatus', {status : 'stop'})
    io.of('/teacher').emit('gameStatus', {status : 'stop'})

    io.of('/teacher').emit('studentList', {list : students})
    //isGameStart = false;
    res.json({status : 'stop'});
});

var studentNsp = io.of('/student');
studentNsp.on('connection', function(socket) {
    var session = socket.id;
    
    console.log(`I'am ${session}`)
    //console.log(students);
    console.log(isGameStart)
    if(isGameStart === true){
        studentNsp.to(session).emit('gameStatus', {status : 'disconnect'});
    }
    /*socket.on('gameStatus', (data) => {
        if(data.status == 'playing'){
            console.log('The game now playing...')
            isGameStart = true;
        }else if(data.status == 'stop'){
            console.log('The game now stoped...')
            students = []
            isGameStart = false;
        }
        io.sockets.emit('gameStatus', {status : data.status});
    })*/
    socket.on('student', function(data){
        let id = data.id;
        students.push(data);

        io.of('/teacher').emit('studentList', {list : students})
        //console.log(students);
    })
    socket.on('disconnect', function() {
        console.log(`bye ${session}`)
        removeStudent = students.filter((el)=>{
            return el.id != session;
        })
        students = removeStudent;

        io.of('/teacher').emit('studentList', {list : students})
        //console.log(students)
    });
});

var teacherNsp = io.of('/teacher');
teacherNsp.on('connection', function(socket) {
    var session = socket.id;
    console.log(`I'am ${session}`)
    teacherNsp.emit('gameStatus', {status : isGameStart})   
    teacherNsp.emit('studentList', {list : students})
});

/*app.listen(PORT, HOST);
console.log('listening on localhost:3000');*/

http.listen(PORT, function() {    
    console.log('listening on localhost:3000');
});