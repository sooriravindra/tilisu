var fs = require('fs');
var mustache = require('Mustache');
var path = require('path');
var http = require("http");
var exec = require('child_process').exec;
var express = require('express');
var serv  = express();
var img_path = path.join(__dirname,'images');
const electron =  require('electron');
const {app, Menu, Tray, BrowserWindow} = electron;

const cmd_battery_percentage = 'WMIC Path Win32_Battery Get EstimatedChargeRemaining';
const cmd_battery_status      = 'WMIC Path Win32_Battery get Availability';

const status_charging = 2;
const status_battery  = 3;

const symbol_charging = "#[fg=colour82]⚡#[fg=colour253]";
const symbol_critical = "#[bg=colour124]⚡#[fg=colour253]";
const symbol_battery  = "⚡";
const symbol_default  = "?";
const dump_file = 'dump.txt'

var battery_percentage=0;
var battery_status=0;
var notify = true;

function get_symbol(status,percentage)
{
	switch(status) {
		case status_charging:
			return symbol_charging;
		case status_battery:
			if(percentage < 20)   {
				return symbol_critical;
			}
			return symbol_battery;
		default:
			return symbol_default;
	}
}
function callback_battery_percentage(error, stdout, stderr){
	var lines = stdout.split('\n');
	var batterySum = 0;
	for(var i = 0;i < lines.length;i++){
		if(!isNaN(lines[i])){
			batterySum += +lines[i];
		} 
	}
	battery_percentage =  batterySum/2;
	battery_percentage = battery_percentage > 100? 100: battery_percentage;
}

function callback_battery_status(error, stdout, stderr){
	var lines = stdout.split('\n');
	for(var i = 0;i < lines.length;i++){
		if(!isNaN(lines[i])){
			battery_status = +lines[i];
			return;
		} 
	}
}

function get_route(full_url)
{
	var i = full_url.indexOf('?');
	if (i == -1)
		return full_url;
	else
		return full_url.slice(0,i);
}

function get_param(name, url) {
	if (!url) url = window.location.href;
	name = name.replace(/[\[\]]/g, "\\$&");
	var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
	    results = regex.exec(url);
	if (!results) return null;
	if (!results[2]) return '';
	return decodeURIComponent(results[2].replace(/\+/g, " "));
}


var appIcon = null;
app.on('ready', () => {
	appIcon = new Tray(path.join(img_path,'tilisu.ico'));
	const contextMenu = Menu.buildFromTemplate([
		{label: 'Notifications', type: 'checkbox', checked: true, click() { notify = !notify} },
		{label: 'Exit', type: 'normal',click(){app.quit()}},
		]);
	appIcon.setToolTip('Tilisu');
	appIcon.setContextMenu(contextMenu);
	appIcon.on('click', function (events,bounds) {
		//exec('notepad ',function(){});
                let win = new BrowserWindow({autoHideMenuBar: true,title: "Tilisu history", icon : path.join(img_path,'tilisu.ico')});
                //win.onbeforeunload = function (e) { return false };
                fs.readFile(path.join(__dirname,dump_file), function (err, data) {
                        if (err) throw err;
                        win.loadURL("data:text;charset=utf-8," + data.toString());
                        win.focus();
                });
	});
	display = electron.screen.getPrimaryDisplay().size;

	serv.use(express.static(img_path));
	serv.get('/tmux_status',function(req,res){
			exec(cmd_battery_percentage, callback_battery_percentage);
			exec(cmd_battery_status, callback_battery_status);
			res.send(get_symbol(battery_status,battery_percentage)+" "+battery_percentage+"%");
	});
	serv.get('/mahiti',function(req,res){
		if (!notify)
		{
			res.send("");
		}
		else{
			title = req.query.title? req.query.title : "Mahiti";
			msg   = req.query.msg? req.query.msg : "Some message!";
                        msg_json = { title : title, content : msg, time : new Date() };
			let win = new BrowserWindow({ height: 100, width :300, frame: false, skipTaskbar: true, transparent: true});
			win.onbeforeunload = function (e) { return false };
			fs.readFile(path.join(__dirname,'mahiti.html'), function (err, data) {
				if (err) throw err;
				var html = mustache.render(data.toString(), msg_json);
				win.loadURL("data:text/html;charset=utf-8," + encodeURI(html));
				win.setPosition(display.width-310,display.height-150);
				win.setAlwaysOnTop(true);
				//win.focus();
			});
                        fs.appendFile(path.join(__dirname,dump_file),JSON.stringify(msg_json)+"\n");
			res.send("");
		}
	});
	serv.listen(8023);
});
app.on('window-all-closed', function(){
});
