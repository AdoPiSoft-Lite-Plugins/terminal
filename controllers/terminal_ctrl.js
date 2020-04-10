'use strict'

var core = require('../../core')
  var session = require("../session")
var path = require("path")
var { admin_socket } = core
var shell = require('shelljs')
var blocked_commands = ['nano', 'vi', 'vim', 'exit', 'telnet']

var running_command

async function killCommand(command){
  if(!command) return
  try{
    await command.kill()
    await command.stdout.destroy()
    await command.stdin.destroy()
  }catch(e){}
}

exports.get = async(req, res, next)=>{
  try{
    shell.cd("~/")
    shell.exec("echo $(pwd)", (e, o)=>{
      res.json({
        info: o,
        outputs: session.outputs
      })
    })
  }catch(e){
    next(e)
  }
}

exports.runCommand = async(req, res, next)=>{
  var { command } = req.body
  try{
    command = (command||"").replace(/sudo/g, "").trim()

    if(command.match(new RegExp(`${blocked_commands.join("|")}`, "g"))){
      admin_socket.emitAdmin('terminal:output', `${command}: command not supported\n`)
      admin_socket.emitAdmin('command:done')
      return res.json({})
    }

    if(command)
      session.command_queue.push(command)

    if (!running_command){
      var done = async()=>{
        try{
          killCommand(running_command)
        }catch(e){}
        running_command = null
        shell.exec("echo $(pwd)", (e, o)=>{
          admin_socket.emitAdmin('command:done', o)
        })
      }
      var cb = (output, _done)=>{
        admin_socket.emitAdmin('terminal:output', output.toString())
        session.outputs.push(output)
        if(session.outputs.length > 20)
          session.outputs.splice(0, 1)
        if(_done) done()
      }
      while(session.command_queue.length > 0){
        if(running_command) continue;
        command = session.command_queue.splice(0, 1)[0]
        var c_split = command.split(" ")
        var fn = shell[c_split[0]]
        var bypass_c = ['echo']
        if( typeof(fn) == 'function' && !bypass_c.includes(c_split[0])){
          c_split.splice(0, 1)
          var arg = c_split.join(' ')
          var o = fn(arg)
          if(o instanceof Array) o = o.join("\n")
          cb( o, true )
        }else{
          if(command == 'clear'){
            session.outputs = []
            admin_socket.emitAdmin("terminal:clear")
            admin_socket.emitAdmin('command:done')
          }else{
            running_command = shell.exec(command, {async:true})
            running_command.stdout.on('data', cb)
            running_command.stderr.on('data', cb)
            running_command.on('close', done )
            running_command.on('error', done )
          }
        }
      }
    }else if(running_command.stdin){
      try{
        await running_command.stdin.write(command)
      }catch(e){
        killCommand(running_command)
        running_command = null
      }
    }

    res.json({})
  }catch(e){
    next(e)
  }
}

exports.abortCommands = async(req, res, next)=>{
  try{
    session.command_queue = []
    if(running_command){
      killCommand(running_command)
      running_command = null
    }
    shell.exec("echo $(pwd)", (e, o)=>{
      admin_socket.emitAdmin('command:done', o)
    })
    res.json({})
  }catch(e){
    next(e)
  }
}
