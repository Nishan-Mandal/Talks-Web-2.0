import { getFirestore, collection, updateDoc, setDoc, doc, serverTimestamp, arrayUnion, query, where, getDoc, getDocs, deleteDoc,orderBy, onSnapshot } from "firebase/firestore";
export class Chatroom {
    constructor(db, docId, uid) {
        this.chatCollection = "chats"+docId.substr(docId.indexOf("+")+1);
        this.uid = uid;
        this.db=db;
        this.docId=docId.substr(0,docId.indexOf("+"));
        this.chats = doc(collection(db, "Text-Messages", docId , this.chatCollection));
        this.unsub;
    }
 
    //Send new chats
    async sendChat(message) {
        const chatId = doc(collection(this.db, "Text-Messages", this.docId , this.chatCollection));
        const response = await setDoc(chatId, {
            uid: this.uid, 
            text: message,
            timestamp: serverTimestamp()
          });
        return response;
    }

    //Get chats
    async getChats(callback) {
        const q = query(collection(this.db, "Text-Messages", this.docId, this.chatCollection),orderBy("timestamp"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
        $("#message-list").empty();
          querySnapshot.forEach((doc) => {
             callback(doc.data());
          });
        });
    }

    //Render chats in ui
    render(data){
        var windowHeight = window.screen.height;
        var flag=false;
        if(this.uid===data.uid){
            flag=true;
        }
        var html=$(``);
        if(data.text!=""){
             html =$(`
            <li style=" width: 80%;
            min-height: ${windowHeight > 800? "":"7vh;"};
            margin-left: ${flag?"55px;":"25px;"};
            margin-top: ${windowHeight > 800? "20px":"10px;"};
            border-radius: ${flag?"15px 15px 0px 15px;":"0px 15px 15px 15px;"};
            background: ${flag?"rgb(45, 202, 207);":"#01a79e"};
            color: #fff;
            padding: ${windowHeight > 800? "20px":"10px"};
            font-weight: 900px;
            font-family: arial;
            position: relative;
            text-align: ${flag?"start;":"left;"}">
                <span class="message">${data.text}</span>
            </li>
        `);
        }
        $("#message-list").append(html);
    }

        //Render chats in ui from chatOnly not for videocall
        renderChatOnly(data){
            var windowHeight = window.screen.height;
            var flag=false;
            if(this.uid===data.uid){
                flag=true;
            }
            var html=$(``);
            if(data.text!=""){
                 html =$(`
                <li style=" 
                width: 80%;
                min-height: ${windowHeight > 800? "":"7vh;"};
                left: ${flag?"15%;":"0%;"};
                right: ${flag?"0%;":"20%;"};
                margin-top: ${windowHeight > 800? "20px":"10px;"};
                border-radius: ${flag?"15px 15px 0px 15px;":"0px 15px 15px 15px;"};
                background: ${flag?"rgb(45, 202, 207);":"#01a79e"};
                color: #fff;
                padding: ${windowHeight > 800? "20px":"10px"};
                font-weight: 900px;
                font-family: arial;
                position: relative;
                text-align: ${flag?"start;":"left;"}" ">
                    <span class="message">${data.text}</span>
                </li>
            `);
            }
            $("#message-list").append(html);
        }
}
