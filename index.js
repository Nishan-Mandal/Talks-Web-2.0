
import { initializeApp } from "firebase/app";
import { getFirestore, collection, updateDoc, setDoc, doc, serverTimestamp, arrayUnion, arrayRemove, query, where, getDoc, getDocs, deleteDoc, onSnapshot, orderBy } from "firebase/firestore";
import { v4 as uuidV4 } from "uuid"
import { Chatroom } from './chat';

const userId = uuidV4();
var messageDocId;
var isSearching;
var userCount = {};
const firebaseConfig = {
  apiKey: "AIzaSyBkRk5JV-gM016M7kvL9hGzgtmoOgGbwNU",
  authDomain: "globalcalls-b0a61.firebaseapp.com",
  databaseURL: "https://globalcalls-b0a61-default-rtdb.firebaseio.com",
  projectId: "globalcalls-b0a61",
  storageBucket: "globalcalls-b0a61.appspot.com",
  messagingSenderId: "345339685076",
  appId: "1:345339685076:web:7d24287548b3e2f1a3b341",
  measurementId: "G-5ED9RRTJ59"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// create Agora client
var client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

var localTracks = {
  videoTrack: null,
  audioTrack: null
};
var remoteUsers = {};
// Agora client options
var options = {
  appid: null,
  channel: null,
  uid: null,
  token: null
};

var leavOrJoin = false;
// the demo can auto join channel with params in url
$(() => {
  var urlParams = new URL(location.href).searchParams;
  options.appid = urlParams.get("appid");
  options.channel = urlParams.get("channel");
  options.token = urlParams.get("token");
  if (options.appid && options.channel) {
    $("#appid").val(options.appid);
    $("#token").val(options.token);
    $("#channel").val(options.channel);
    $("#join-form").submit();
  }
})

$("#join").click(start);

async function start(e) {
  changeJoinButtonText();
  if (!leavOrJoin) {
    // e.preventDefault();
   $("#join").attr("disabled", true);
    try {
      // joinVideo("Nishan", "Male", ['random', 'random'], "33422");
      tempJoin();
      if (options.token) {
        $("#success-alert-with-token").css("display", "block");
      } else {
        $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
        //  $("#success-alert").css("display", "block");
      }
    } catch (error) {
      console.error(error);
    } finally {}
    leavOrJoin = true;
  }
  else {
    leave();
    leavOrJoin = false;
    // preLeave(joinCode);
  }
}

async function join(joincode) {
  options.appid = '96612da98436477eb37a3d018dcdb950';
  options.token = $("#token").val();
  // add event listener to play remote tracks when remote user publishs.
  client.on("user-published", handleUserPublished);
  client.on("user-unpublished", handleUserUnpublished);

  // join a channel and create local tracks, we can use Promise.all to run them concurrently
  [options.uid, localTracks.audioTrack, localTracks.videoTrack] = await Promise.all([
    // join the channel
    client.join(options.appid, joincode, options.token || null),
    // create local tracks, using microphone and camera
    AgoraRTC.createMicrophoneAudioTrack(),
    AgoraRTC.createCameraVideoTrack()
  ]);

  // play local video track
  localTracks.videoTrack.play("local-player");
  $("#local-player-name").text(`localVideo(${options.uid})`);

  // publish local tracks to channel
  await client.publish(Object.values(localTracks));
  console.log("publish success");
  loaderStop();
  $("#join").attr("disabled", false);
}



async function leave() {
  $('#loader1').removeClass("loader1");

  const docRef = doc(db, "videoCallsUsers-online", "Online-Users");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    if(docSnap.data().roomId[0] === messageDocId){
       updateDoc(docRef, {
        roomId: arrayRemove(messageDocId)
      });
    }    
  }

  for (var trackName in localTracks) {
    var track = localTracks[trackName];
    if (track) {
      track.stop();
      track.close();
      localTracks[trackName] = undefined;
    }
  }
  // remove remote users and player views
  remoteUsers = {};
  $("#remote-playerlist").html("");
  // leave the channel
  await client.leave();
  $("#local-player-name").text("");
  $("#join").attr("disabled", false);
  $("#leave").attr("disabled", true);
  console.log("client leaves channel success");
}

async function subscribe(user, mediaType) {
  const uid = user.uid;
  // subscribe to a remote user
  await client.subscribe(user, mediaType);
  console.log("subscribe success");
  if (mediaType === 'video') {
    var player;                                 
    if(window.screen.width < 800){
       player = $(`
      <div style="height: 55vh; width: 96vw; border-radius: 15px; overflow: hidden; perspective: 1px;" id="player-${uid}" class="player"></div>
    `);
    }
    else{
       player = $(`
      <div style="height: 77vh; width: 68.3vw; border-radius: 15px; overflow: hidden; perspective: 1px;" id="player-${uid}" class="player"></div>
    `);
    }
    remoteUsers = {};
    $("#remote-playerlist").html("");
    $('#loader1').removeClass("loader1");
    $("#remote-playerlist").append(player);
    user.videoTrack.play(`player-${uid}`);
  }
  if (mediaType === 'audio') {
    user.audioTrack.play();
  }
}

function handleUserPublished(user, mediaType) {
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

function handleUserUnpublished(user) {
  $('#loader1').addClass("loader1");
  leave();
  start();
  const id = user.uid;
  delete remoteUsers[id];
  $(`#player-wrapper-${id}`).remove();
}

function changeJoinButtonText() {
    var elem = document.getElementById("join");
    if(elem.value === "Join"){
      elem.innerHTML = `Stop`
      elem.value = "Stop";
    }
    else{
      elem.innerHTML = `Join`
      elem.value = "Join";
    }  
}

$("#send").click(async function (e) {
  onLeaveOrCloseWindow(userId,messageDocId);
});

var input = document.getElementById("text-box");
input.addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    let get = document.getElementById('text-box');
    if(!isSearching && get.value.trim().length!=0){
      const chatRoom = new Chatroom(db, messageDocId, userId);
      chatRoom.sendChat(get.value);
      get.value="";
    }
  }
});

function loaderStart(){
  $('#loader1').addClass("loader1");
  $('#loader2').addClass("loader2");
}

function loaderStop(){
  $('#loader2').removeClass("loader2");
}

async function onLeaveOrCloseWindow(queueId,msgId){
  const docRef = doc(db, "videoCallsUsers-online", "Online-Users");
  const docSnap =  await getDoc(docRef);
  if (docSnap.exists()) {
     updateDoc(docRef, {
      queue: arrayRemove(queueId),
      roomId: arrayRemove(msgId)
    });  
  }
}

async function tempJoin(){
  loaderStart();
  const docRef = doc(db, "videoCallsUsers-online", "Online-Users");
  await updateDoc(docRef,{
    queue: arrayUnion(userId),
  });

  const  unsub =  onSnapshot(doc(db, "videoCallsUsers-online", "Online-Users"), async (doc) => {
     var idxZero = doc.data().queue[0];
     var idxOne = doc.data().queue[1];
     var roomId = doc.data().roomId[0];
     if(idxZero === userId){
       if(roomId ===  undefined){
        unsub();
        var uniqueId = uuidV4();
        messageDocId = uniqueId;
        await updateDoc(docRef, {
          roomId: arrayUnion(uniqueId),
          queue: arrayRemove(userId)
        });   
        await join(uniqueId);
       }
       else{
        unsub();
        messageDocId = roomId;
        await updateDoc(docRef, {
          roomId: arrayRemove(roomId),
          queue: arrayRemove(userId)
        });  
        await join(roomId);
        if(getUserCount() === 0){
          await updateDoc(docRef, {
            roomId: arrayUnion(messageDocId)
          });
        }
       }
     }
     else if(idxOne === userId){
      setTimeout(async function(){
        await updateDoc(docRef, {
          queue: arrayRemove(idxZero)
        });  
      }, 3000); 
     }

     const chatRoom = new Chatroom(db, messageDocId, userId);
     chatRoom.getChats(data => {
       chatRoom.render(data);
     });

  });
}

window.onbeforeunload = function(){
  sessionStorage.setItem("msgId", messageDocId);
  sessionStorage.setItem("queueId", userId);
  onLeaveOrCloseWindow(userId,messageDocId);
  return ""; 
};

window.onload = function() {
  var msgId = sessionStorage.getItem("msgId");
  var queueId = sessionStorage.getItem("queueId");
  sessionStorage.removeItem("msgId");
  sessionStorage.removeItem("queueId");
  onLeaveOrCloseWindow(queueId,msgId);
}
window.onunload = function() {
  onLeaveOrCloseWindow(userId,messageDocId);
}

function getUserCount(){
  return Object.keys(remoteUsers).length;
}