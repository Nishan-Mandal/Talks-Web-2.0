
import { initializeApp } from "firebase/app";
import { getFirestore, collection, updateDoc, setDoc, doc, serverTimestamp, arrayUnion, arrayRemove, query, where, getDoc, getDocs, deleteDoc, onSnapshot, orderBy } from "firebase/firestore";
import { v4 as uuidV4 } from "uuid"
import { Chatroom } from './chat';

const userId = uuidV4();
var messageDocId;
var isBothConnected = false;
var isJoined = false;
var tempIdxZero;
var chatUnsub;
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
  if (!isJoined) {
    // e.preventDefault();
    $("#join").attr("disabled", true);
    try {
      joinVideo();
      if (options.token) {
        $("#success-alert-with-token").css("display", "block");
      } else {
        $("#success-alert a").attr("href", `index.html?appid=${options.appid}&channel=${options.channel}&token=${options.token}`);
      }
    } catch (error) {
      console.error(error);
    } finally { }
    isJoined = true;
  }
  else {
    isJoined = false;
    $("#join").attr("disabled", true);
    leave();
  }
}

async function join(joincode, docReference) {
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
  isBothConnected = false;
  const docRef = doc(db, "videoCallsUsers-online", "Online-Users");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    updateDoc(docRef, {
      queue: arrayRemove(userId),
      roomId: arrayRemove(messageDocId)
    });
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
    if (window.screen.width < 800) {
      player = $(`
      <div style="height: 55vh; width: 96vw; border-radius: 15px; overflow: hidden; perspective: 1px;" id="player-${uid}" class="player"></div>
    `);
    }
    else {
      player = $(`
      <div style="height: 77vh; width: 68.3vw; border-radius: 15px; overflow: hidden; perspective: 1px;" id="player-${uid}" class="player"></div>
    `);
    }
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
  isBothConnected = true;
  const id = user.uid;
  remoteUsers[id] = user;
  subscribe(user, mediaType);
}

async function reCreateChatCollection(choice){
  //Replacing chat collection name every time in database
  var replacingStr = messageDocId.substr(messageDocId.indexOf("+") + 1);
  var replaceByStr = +replacingStr + 1; //Type casting from string to number
  messageDocId = messageDocId.replace("+" + replacingStr, "+" + replaceByStr);

  const docRef = doc(db, choice=="videocall"?"videoCallsUsers-online":"chattingUser-online", "Online-Users");
  await updateDoc(docRef, {
    roomId: arrayUnion(messageDocId)
  });

  const chatRoom = new Chatroom(db, messageDocId, userId);
  chatRoom.getChats(data => {
    choice=="videocall"?chatRoom.render(data):chatRoom.renderChatOnly(data);
  });
}

async function handleUserUnpublished(user) {
  $('#loader1').addClass("loader1");
  isBothConnected = false;
  if (getUserCount() === 0) {
    reCreateChatCollection("videocall");
  }

  // Stop searching after 10 sec
  setTimeout(async function () {
    if (getUserCount() === 0) {
      leave();
      changeJoinButtonText();
    }
  }, 10000);

  //Try to put everythings above this code otherwise handleUserUnpublished called twice
  const id = user.uid;
  delete remoteUsers[id];
  $(`#player-wrapper-${id}`).remove();
}

function changeJoinButtonText() {
  var elem = document.getElementById("join");
  if (elem.value === "Join") {
    elem.innerHTML = `Stop`
    elem.value = "Stop";
  }
  else {
    elem.innerHTML = `Join`
    elem.value = "Join";
  }
}

$("#send").click(async function (e) {
  let get = document.getElementById('text-box');
  if (isBothConnected && get.value.trim().length != 0) {
    const chatRoom = new Chatroom(db, messageDocId, userId);
    chatRoom.sendChat(get.value);
    get.value = "";
  }
});

var input = document.getElementById("text-box");
input.addEventListener("keypress", function (event) {
  if (event.key === "Enter") {
    let get = document.getElementById('text-box');
    if (isBothConnected && get.value.trim().length != 0) {
      const chatRoom = new Chatroom(db, messageDocId, userId);
      chatRoom.sendChat(get.value);
      get.value = "";
    }
  }
});

function loaderStart() {
  $('#loader1').addClass("loader1");
  $('#loader2').addClass("loader2");
}

function loaderStop() {
  $('#loader2').removeClass("loader2");
}

async function onLeaveOrCloseWindow(queueId, msgId) {
  var choice = localStorage.getItem("choice");
  const docRef = doc(db, choice == "videoCall"?"videoCallsUsers-online":"chattingUser-online", "Online-Users");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    updateDoc(docRef, {
      queue: arrayRemove(queueId),
      roomId: arrayRemove(msgId)
    });
  }
}

async function joinVideo() {
  var gender = localStorage.getItem('gender');
  var isFemaleSearch = false;
  loaderStart();
  const docRef = doc(db, "videoCallsUsers-online", "Online-Users");
  if (gender === "female") {

    const docReference = doc(db, "videoCallsUsers-online", "Online-Searching-Females");
    const docSnap = await getDoc(docReference);

    if (docSnap.exists()) {
      var lenQueue = docSnap.data().queue.length;
      var lenRoomId = docSnap.data().roomId.length;
      if (lenRoomId > lenQueue) {
        isFemaleSearch = true;
        await joinFemales(docRef);
      }
    }
  }
  if (!isFemaleSearch) {

    await updateDoc(docRef, {
      queue: arrayUnion(userId),
    });

    const unsub = onSnapshot(doc(db, "videoCallsUsers-online", "Online-Users"), async (doc) => {
      var idxZero = doc.data().queue[0];
      var idxN = doc.data().queue[doc.data().queue.length - 1];
      var roomId = doc.data().roomId[0];
      //If user at the 0th index 
      if (idxZero === userId) {
        //If no room is exists, user creating it's own room
        if (roomId === undefined) {
          unsub();
          var uniqueId = uuidV4();
          messageDocId = uniqueId + "+1";
          await updateDoc(docRef, {
            roomId: arrayUnion(messageDocId),
            queue: arrayRemove(userId)
          });
          await join(messageDocId.substr(0, messageDocId.indexOf("+")), docRef);
        }
        //If romm is already created, user will just join the room
        else {
          unsub();
          messageDocId = roomId;
          await updateDoc(docRef, {
            roomId: arrayRemove(roomId),
            queue: arrayRemove(userId)
          });
          await join(messageDocId.substring(0, messageDocId.indexOf("+")), docRef);

          // If user joined in an empty rooom, below code will make the room active by putting the room Id in roomId queue
          setTimeout(async function () {
            if (getUserCount() === 0) {
              await updateDoc(docRef, {
                roomId: arrayUnion(messageDocId)
              });
            }
            else{
              isBothConnected = true;
            }
          }, 3000);
        }

        // This is for initiating the message
        const chatRoom = new Chatroom(db, messageDocId, userId);
        chatRoom.getChats(data => {
          chatRoom.render(data);
        });

      }
      //If user index is not 0, User execute the below code to delete inactive id's from queue after 5 sec
      else if (idxN === userId) {
        tempIdxZero = idxZero;
        setTimeout(async function () {
          if (idxZero === tempIdxZero) {
            await updateDoc(docRef, {
              queue: arrayRemove(idxZero)
            });
          }
        }, 5000);//delay of 5 sec
      }

    });
  }
}

//If someone is waiting for female and the current user is female. This method is invoked from joinVideo() method
async function joinFemales(docReference) {
  const docRef = doc(db, "videoCallsUsers-online", "Online-Searching-Females");
  await updateDoc(docRef, {
    queue: arrayUnion(userId),
  });

  const unsub = onSnapshot(doc(db, "videoCallsUsers-online", "Online-Searching-Females"), async (doc) => {
    var idxZero = doc.data().queue[0];
    var roomId = doc.data().roomId[0];
    //If user is at 0th index
    if (idxZero === userId) {
      if (roomId != undefined) {
        unsub();
        messageDocId = roomId;
        await updateDoc(docRef, {
          roomId: arrayRemove(messageDocId),
          queue: arrayRemove(userId)
        });
        await join(roomId, docRef);
        setTimeout(async function () {
          if (getUserCount() === 0) {
            await updateDoc(docReference, {
              roomId: arrayUnion(messageDocId)
            });
          }
        }, 3000);
      }
      else {
        //Deleting UserId from queue and again call the joinVideo()
        await updateDoc(docRef, {
          queue: arrayRemove(userId)
        });
        joinVideo();
      }

      const chatRoom = new Chatroom(db, messageDocId, userId);
      chatRoom.getChats(data => {
        chatRoom.render(data);
      });
    }
  });
}

//If user closed the tab
window.onbeforeunload = function () {
  sessionStorage.setItem("msgId", messageDocId);
  sessionStorage.setItem("queueId", userId);
  onLeaveOrCloseWindow(userId, messageDocId);
  return "";
};

//Executes after reloading the tab
window.onload = function () {
  var msgId = sessionStorage.getItem("msgId");
  var queueId = sessionStorage.getItem("queueId");
  sessionStorage.removeItem("msgId");
  sessionStorage.removeItem("queueId");
  onLeaveOrCloseWindow(queueId, msgId);
}
window.onunload = function () {
  onLeaveOrCloseWindow(userId, messageDocId);
}

function getUserCount() {
  return Object.keys(remoteUsers).length;
}

//Chatting only ------------------------------------------------------------------------
var idWithoutChatNo;

//On clicking the join button
$("#join-chatting").click(startChatting);

async function startChatting(e) {
  changeJoinButtonTextChatting();
  if (!isJoined) {
    $("#join-chatting").attr("disabled", true);
    try {
      await joinChattionOnly();
    } catch (error) {
      console.error(error);
    } 
    isJoined = true;
  }
  else {
    $("#join-chatting").attr("disabled", true);
    var elem = document.getElementById("message-list");
    elem.innerHTML='';
    isJoined = false;
    leaveChatting();
  }
}

async function leaveChatting(){
  chatUnsub();
  hideIsConnectedIcon();
  $('#loader1').removeClass("loader1");
  isJoined = false;
  const docRef = doc(db, "chattingUser-online", "Online-Users");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    updateDoc(docRef, {
      queue: arrayRemove(userId),
      roomId: arrayRemove(messageDocId)
    });
  }
  updateDoc(doc(db, "Text-Messages", idWithoutChatNo), {
    isBothJoined: false,
    isOneLeft:true
  });
  idWithoutChatNo = null;
  $("#join-chatting").attr("disabled", false);
}

function changeJoinButtonTextChatting() {
  var elem = document.getElementById("join-chatting");
  if (elem.value === "Join") {
    elem.innerHTML = `Stop`
    elem.value = "Stop";
  }
  else {
    elem.innerHTML = `Join`
    elem.value = "Join";
  }
}

function hideIsConnectedIcon(){
  var elem = document.getElementById("isConnected");
  elem.style.display = "none";
}

function showIsConnectedIcon(){
  var elem = document.getElementById("isConnected");
  elem.style.display = "block";
}

async function joinChattionOnly() {
  var gender = localStorage.getItem('gender');
  var isFemaleSearch = false;
  $('#loader1').addClass("loader1");
  const docRef = doc(db, "chattingUser-online", "Online-Users");
  if (gender === "female") {

    const docReference = doc(db, "chattingUser-online", "Online-Searching-Females");
    const docSnap = await getDoc(docReference);

    if (docSnap.exists()) {
      var lenQueue = docSnap.data().queue.length;
      var lenRoomId = docSnap.data().roomId.length;
      if (lenRoomId > lenQueue) {
        isFemaleSearch = true;
        // await joinFemales(docRef);
      }
    }
  }
  if (!isFemaleSearch) {
    await updateDoc(docRef, {
      queue: arrayUnion(userId),
    });

    //Stream from firestore
    const unsub = onSnapshot(doc(db, "chattingUser-online", "Online-Users"), async (docs) => {
      var idxZero = docs.data().queue[0];
      var idxN = docs.data().queue[docs.data().queue.length - 1];
      var roomId = docs.data().roomId[0];
      //If User is at 0th index
      if (idxZero === userId) {
        //If no exixting room is present
        if (roomId === undefined) {
          unsub();
          var uniqueId = uuidV4();
          idWithoutChatNo = uniqueId;
          messageDocId = uniqueId + "+1";
          await updateDoc(docRef, {
            roomId: arrayUnion(messageDocId),
            queue: arrayRemove(userId)
          });
          await setDoc(doc(db, "Text-Messages", uniqueId), {
            isBothJoined: false,
            isOneLeft: false
          });

        }
        //If room already exists, user will just join the room
        else {
          unsub();
          messageDocId = roomId;
          idWithoutChatNo = messageDocId.substr(0,messageDocId.indexOf("+"));
          await updateDoc(docRef, {
            roomId: arrayRemove(roomId),
            queue: arrayRemove(userId)
          });

          await updateDoc(doc(db, "Text-Messages", idWithoutChatNo), {
            isBothJoined: true,
            isOneLeft:false
          });
        }

        // This is for initiating the message
        const chatRoom = new Chatroom(db, messageDocId, userId);
        chatRoom.getChats(data => {
          chatRoom.renderChatOnly(data);
        });
    
        //Stream of chat doc
         chatUnsub = onSnapshot(doc(db, "Text-Messages", idWithoutChatNo), async (chatDoc) => {
          var isBothJoined = chatDoc.data().isBothJoined;
          var isOneLeft = chatDoc.data().isOneLeft;
          if(isBothJoined){
            $('#loader1').removeClass("loader1");
            isBothConnected=true;
            showIsConnectedIcon();
          }
          if(!isBothJoined){
            $('#loader1').addClass("loader1");
            isBothConnected=false;
          }
          if(isOneLeft){
            var elem = document.getElementById("message-list");
            elem.innerHTML='';
            reCreateChatCollection("chatOnly");
            hideIsConnectedIcon();
          }

        });
        $("#join-chatting").attr("disabled", false);

      }
      // To delete inactive id's from queue
      else if (idxN === userId) {
        tempIdxZero = idxZero;
        setTimeout(async function () {
          if (idxZero === tempIdxZero) {
            await updateDoc(docRef, {
              queue: arrayRemove(idxZero)
            });
          }
        }, 5000);//delay of 5 sec
      }

    });
  }
 
}