const express = require('express');
const app = require('express')();
const mysql = require('mysql');
const http = require('http').Server(app);
const io = require('socket.io')(http);
var Promise = require('promise');

const PORT = 80;
const HOST = 'localhost';

const db = mysql.createConnection({
    host        :   process.env.DB_HOST,
    user        :   process.env.DB_USER,
    password    :   process.env.DB_PASSWORD,
    database    :   process.env.DB_NAME,
    port        :   3306
});

db.connect((err) => {
    if(err){
        throw err;
    }
    console.log('MySQL Connected ....')
});

var students = [];
//var team = [];
var isGameStart = false;


app.use(express.static('public'));

app.get('/', function(req, res) {
   res.sendfile('./index.html');
});

app.get('/play', function(req, res) {
    res.sendfile('./student.html');
 });

app.get('/teacher', function(req, res) {
    res.sendfile('./teacher.html');
});

app.get('/checkDupStudent', function(req, res) {
    let name = req.query.name;
    var checkDup = false;
    for(let student of students){
        if(student.name == name){
            checkDup = true
            break;
        }
    }
    res.json({result : checkDup});
});

app.get('/startGame', function(req, res) {

    

    if(students.length < 2){
        io.of('/teacher').emit('message', {message : 'Please wait student at least 2 people'})
    }else{

        isGameStart = true;
        io.of('/student').emit('gameStatus', {status : 'playing'})
        io.of('/teacher').emit('gameStatus', {isGameStart : isGameStart})

        let studentsLength = students.length
        let numberList = []

        //Swap position of students
        while(numberList.length < studentsLength){
            let randomNum = Math.floor((Math.random() * studentsLength));
            if(numberList.indexOf(randomNum) < 0) numberList.push(randomNum);
        }

        
        
        new Promise((resolve, reject) => {

            db.query("SELECT * FROM taksinmath.problems ORDER BY problem_group, problem_pair", function (err, result, fields) {
                if (err) throw err;
    
                let resultTem = result;
                let problem = [];
                
                //Swap position [question and answer] in problem
                while(result.length > 0){
                    let randomNum = Math.floor((Math.random() * result.length));
                    
                    if(randomNum % 2 !== 0){
                        problem.push(result[randomNum])
                        problem.push(result[randomNum - 1])
                        result.splice(randomNum, 1) //Remove data from result
                        result.splice(randomNum - 1, 1)
                    }
                }
    
                let pairKey = "";
                let pairList = [];
                let countPair = 0;
                let team = []
                let team_students = [];
    
                let i = 0;
                for(let index of numberList){
                    //let student_id = students[index].id; // .substring(9)
                    //let student_name = students[index].name; // .substring(9)
                    //console.log('send to -> ', student_id , ' problem -> ', result[i])

                    students[index].problem = problem[i]
                    
                    countPair++;
                    if(countPair === 1){
                        while(pairList.indexOf(pairKey = Math.floor((Math.random() * 99999))+10000) > 0);
                        pairList.push(pairKey);

                        team_students.push(students[index]);

                        if(i == (numberList.length - 1) && i+1 % 2 != 0){
                            team.push({
                                students : team_students,
                                point : 10000,
                                isWin : false,
                                pairKey : pairKey
                            })
    
                            team_students = []
                            countPair = 0
                        }
                    }
                    
                    if(countPair === 2){
                        team_students.push(students[index]);

                        team.push({
                            students : team_students,
                            point : 10000,
                            isWin : false,
                            pairKey : pairKey
                        })

                        team_students = []
                        countPair = 0
                    }

                    i++
                }

                console.log(team)
                for(let index in team){
                    for(let data of team[index].students){
                        io.of('/student').to(data.id).emit('problem', {problem : data.problem, pairKey : team[index].pairKey, team : team[index]});
                    }
                }

                /*for(let id in send_students){
                    console.log(team)
                    io.of('/student').to(id).emit('problem', {problem : problem[i], pairKey : pairKey, team : team});
                }*/

                resolve(team);
            });
        });
        
        /*sendProblem.then((t) => {
            io.of('/student').emit('team', {team : t});
        })*/

        console.log('The game now playing...')
        
        res.json({status : 'playing'});
    }
});
app.get('/stopGame', function(req, res) {

    console.log('The game now stoped...')

    students = [];
    //team = [];
    isGameStart = false;

    io.of('/student').emit('gameStatus', {status : 'stop'})
    io.of('/teacher').emit('gameStatus', {isGameStart : isGameStart})

    io.of('/teacher').emit('studentList', {list : students})
    //isGameStart = false;
    res.json({status : 'stop'});
});

var studentNsp = io.of('/student');
studentNsp.on('connection', function(socket) {
    var session = socket.id;
    
    //console.log(`I'am ${session}`)
    //console.log(students);
    //console.log(isGameStart)
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
        var id = data.id;

        students.push(data);
        io.of('/teacher').emit('studentList', {list : students})
        
        //console.log(students);
    })

    socket.on('update_team_status', function(data){
        studentNsp.to(data.friendId).emit('team_status', {point : data.point, isWin : data.isWin});
    })
    
    socket.on('disconnect', function() {
        //console.log(`bye ${session}`)
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
    //console.log(`I'am ${session}`)
    teacherNsp.emit('gameStatus', {isGameStart : isGameStart})   
    teacherNsp.emit('studentList', {list : students})
});

/*app.listen(PORT, HOST);
console.log('listening on localhost:3000');*/

http.listen(PORT, function() {    
    console.log('listening on localhost:' + PORT);
});