
import { initializeApp } from "firebase/app";
import { getFirestore, collection, updateDoc, setDoc, doc, serverTimestamp, arrayUnion, query, where, getDoc, getDocs, deleteDoc, onSnapshot } from "firebase/firestore";
import { v4 as uuidV4 } from "uuid"
import { Chatroom } from './chat';

const uid = uuidV4();
var joinCode;
var messageDocId;
var isSearching;
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

$("#join").click(async function (e) {
  console.log("join clicked");
  changeJoinButtonText();
  if (!leavOrJoin) {
    e.preventDefault();
   $("#join").attr("disabled", true);
    try {
      joinVideo("Nishan", "Male", ['random', 'random'], "33422");
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
    const docRef = doc(db, "videoCallsUsers-online", joinCode);
    const reqSnap = await getDoc(docRef);
    if (reqSnap.exists()) {
      var docSearching = reqSnap.data().searching;
      if(docSearching===true){
        await deleteDoc(doc(db, "videoCallsUsers-online", joinCode));
      }
      else{
        await updateDoc(docRef, {
          searching: true,
          messageCode: null,
          request: []
        });
      }
    } else {
      console.log("No such document!");
    }
    leavOrJoin = false;
  }
})

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
}

async function leave() {
  $('#loader1').removeClass("loader1");
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
      <div style="height: 60vh; width: 96vw; border-radius: 15px; overflow: hidden; perspective: 1px;" id="player-${uid}" class="player"></div>
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

async function joinVideo(displayName, usersGender, searchForWhome) {
  loaderStart();
  var tempJoinCode;
  const q = query(collection(db, "videoCallsUsers-online"), where("searchForWhome", "array-contains", "random"), where("searching", "==", true));

  const querySnapshot = await getDocs(q);
  querySnapshot.forEach((doc) => {
    joinCode = doc.data().joinCode;
    tempJoinCode=joinCode;
  })
  if (tempJoinCode != undefined) {
    const docRef = doc(db, "videoCallsUsers-online", joinCode);
    await updateDoc(docRef, {
      request: arrayUnion(uid)
    });

    var indexZero;
    const req = doc(db, "videoCallsUsers-online", joinCode);
    const reqSnap = await getDoc(req);
    if (reqSnap.exists()) {
      indexZero = reqSnap.data().request[0];
    } else {
      console.log("No such document!");
    }

    if (indexZero === uid) {
      messageDocId = uuidV4();
      await updateDoc(docRef, {
        messageCode: messageDocId,
        searching: false
      });
      await join(joinCode);

      const message = doc(db, "videoCallsMessages", messageDocId);
      await setDoc(message, {
        userName1: displayName,
        userName2: " ",
        userEmail1: null,
        userEmail2: null,
        someOneEndsCall: false
      });

      const unsub = onSnapshot(doc(db, "videoCallsUsers-online", joinCode), (doc) => {
        isSearching = doc.data().searching;
        if(doc.data().messageCode!=null){
          messageDocId = doc.data().messageCode;
          const chatRoom = new Chatroom(db, messageDocId, uid);
          chatRoom.getChats(data => {
            chatRoom.render(data);
          });
        }
      });

      const chatInit = doc(collection(db, "videoCallsMessages", messageDocId, "chats"));
      await setDoc(chatInit, {
        uid: uid,
        text: "",
        timestamp: serverTimestamp()
      });

      const chatRoom = new Chatroom(db, messageDocId, uid);
      chatRoom.getChats(data => {
        chatRoom.render(data);
      });


    }
    else {
      return joinVideo(displayName, usersGender, searchForWhome, joinCode);
    }
  }
  else {
    const ref = doc(collection(db, "videoCallsUsers-online"));
    joinCode=ref.id;
    await setDoc(ref, {
      name: displayName,
      joinCode: ref.id,
      messageCode: null,
      gender: usersGender,
      searchForWhome: searchForWhome,
      timeStamp: serverTimestamp(),
      searching: true,
      uid:uid
    });
    await join(ref.id);
    
    const unsub = onSnapshot(doc(db, "videoCallsUsers-online", ref.id), (doc) => {
      isSearching = doc.data().searching;
      if(doc.data().messageCode!=null){
        messageDocId = doc.data().messageCode;
        const chatRoom = new Chatroom(db, messageDocId, uid);
        chatRoom.getChats(data => {
          chatRoom.render(data);
        });
      }
    });
  }
  loaderStop();
  $("#join").attr("disabled", false);
}
$("#send").click(async function (e) {
  let get = document.getElementById('text-box');
  if(!isSearching && get.value.trim().length!=0){
    const chatRoom = new Chatroom(db, messageDocId, uid);
    chatRoom.sendChat(get.value);
    get.value="";
  }
});

var input = document.getElementById("text-box");
input.addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    let get = document.getElementById('text-box');
    if(!isSearching && get.value.trim().length!=0){
      const chatRoom = new Chatroom(db, messageDocId, uid);
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

window.onbeforeunload = function(){
  localStorage.setItem("joinCode", joinCode);
  return true;
};
window.onunload = function() {
  onLeaveOrCloseWindow();
}
window.onload = function() {
  var flagJoinCode = localStorage.getItem("joinCode");
  if (flagJoinCode != undefined){
    onLeaveOrCloseWindow(flagJoinCode);
  }
}

async function onLeaveOrCloseWindow(docId){
  const docRef = doc(db, "videoCallsUsers-online", docId);
  const reqSnap = await getDoc(docRef);
  if (reqSnap.exists()) {
    var docSearching = reqSnap.data().searching;
    if(docSearching===true){
      leave();
      await deleteDoc(doc(db, "videoCallsUsers-online", docId));
    }
    else{
      await updateDoc(docRef, {
        searching: true,
        messageCode: null,
        request: []
      });
    }
  } else {
    console.log("No such document!");
  }
  leavOrJoin = false;
}