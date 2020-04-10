(function () {
  'use strict';
  var App = angular.module('Plugins')

  App.controller('TerminalPluginCtrl', function($scope, TerminalPluginService, toastr, Socket, $timeout){
    var term
    var command = ""
    var history = []
    var cur_index
    var input_ready = false
    function printOutput(o){
      o = o.split("\n")//.map(function(i){ return i.trim() })
      o.forEach(function(e){
        term.write('\r\n '+e);
      })
    }
    function navigateHistory(i){
      var c = history[i]
      for(var i=0; i<command.length;i++){
        term.write('\b \b');
      }
      command = c || ""
      term.write(command)
    }
    $timeout(function(){
      term = new Terminal();
      var fitAddon = new FitAddon.FitAddon();
      var webLinksAddon = new WebLinksAddon.WebLinksAddon();
      var el = document.getElementById('terminal')
      el.innerText = ""
      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.open(el);
      fitAddon.fit();
      term.prompt = function(){
        input_ready = true
        command = ""
        term.write('\r\n'+$scope.info+'$ ');
      };

      $scope.outputs.forEach(function(o){
        printOutput(o)
      })
      term.prompt()
      term.onData(function(d, e){
        if(!d || d.length <= 5) return false
        command += d
        term.write(d);
        return false
      })
      term.onKey(function(e){
        if(!input_ready) return
        if(e.domEvent.keyCode == 9) return //tab
        var printable = !e.domEvent.altKey && !e.domEvent.altGraphKey && !e.domEvent.ctrlKey && !e.domEvent.metaKey;
        if (e.domEvent.keyCode === 13) {
          $scope.runCommand(command)
          command = ""
          term.prompt();
        } else if (e.domEvent.keyCode === 8) {
          // Do not delete the prompt
          if (term._core.buffer.x > $scope.info.length+2) {
            term.write('\b \b');
            command = command.substr(0, command.length-1)
          }
        }else if(e.domEvent.keyCode == 38){ //arrow-up
          if(isNaN(cur_index) || cur_index < 0){
            cur_index = history.length -1
          }else{
            cur_index -= 1
          }
          navigateHistory(cur_index)
        }else if(e.domEvent.keyCode == 40){ //arrow-down
          if(isNaN(cur_index) || cur_index < 0 || cur_index >= history.length){
            cur_index = 0
          }else{
            cur_index += 1
          }
          navigateHistory(cur_index)
        }else if(e.domEvent.keyCode == 86 && e.domEvent.ctrlKey){
          navigator.clipboard.readText().then(function(text){
            command += text
            term.write(text)
          })
        }else if (printable) {
          command += e.key
          term.write(e.key);
        }else if(e.domEvent.keyCode == 67 && e.domEvent.ctrlKey){ // ctrl+c
          $scope.abortCommands()
        }
      });
    }, 2000)

    var socket = Socket.getSocket();
    $scope.info = ""
    socket.on('terminal:clear', function(){
      $scope.outputs = [];
    })
    socket.on('terminal:output', function(o){
      printOutput(o)
      $scope.outputs.push(o)
    })
    socket.on('command:done', function(current_dir){
      current_dir = (current_dir||"").trim()
      if(current_dir && current_dir != $scope.info)
        $scope.info = current_dir
      term.prompt()
    })

    TerminalPluginService.get().then(function(res){
      var data = res.data || {}
      $scope.info = (data.info || "").trim()
      $scope.outputs = data.outputs || []
    })
    $scope.runCommand = function(command){
      if(!command) return
      if(command.toLowerCase() == 'clear'){
        term.clear()
      }
      input_ready = false
      TerminalPluginService.runCommand(command)
      history.push(command)
      cur_index = null
    }
    $scope.abortCommands = function(){
      TerminalPluginService.abortCommands()
      input_ready = true
    }
  })
})();
