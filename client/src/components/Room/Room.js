import React, { useState, useEffect, useRef } from "react";
import Peer from "simple-peer";
import styled from "styled-components";
import socket from "../../socket";
import STT from "stt.js";
import VideoCard from "../Video/VideoCard";
import BottomBar from "../BottomBar/BottomBar";
import Chat from "../Chat/Chat";
import Dialog from "../Dialog/Dialog";
import { fetchChatbotResponse } from "../Chatbot/Chatbot";
// import { useUser } from "../../contexts/UserContext";

const Room = (props) => {
  const [isChatBubbleVisible, setChatBubbleVisible] = useState(false);
  const toggleChatBubble = () => {
    setChatBubbleVisible((prev) => !prev);
  };

  // ** 수정
  const currentUser = sessionStorage.getItem("user");
  const [peers, setPeers] = useState([]);
  const [userVideoAudio, setUserVideoAudio] = useState({
    localUser: { video: true, audio: true },
  });
  const [videoDevices, setVideoDevices] = useState([]);
  const [screenShare, setScreenShare] = useState(false);
  const [showVideoDevices, setShowVideoDevices] = useState(false);
  const peersRef = useRef([]);
  const userVideoRef = useRef();
  const screenTrackRef = useRef();
  const userStream = useRef();
  const roomId = props.match.params.roomId;

  const stt = useRef(null);

  useEffect(() => {
    // Get Video Devices
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const filtered = devices.filter((device) => device.kind === "videoinput");
      setVideoDevices(filtered);
    });

    // Set Back Button Event
    window.addEventListener("popstate", handleStop);

    // Connect Camera & Mic
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        userVideoRef.current.srcObject = stream;
        userStream.current = stream;
        //stt.start();

        // STT 초기화 ============================================
        stt.current = new STT({
          continuous: true,
          interimResults: true,
        });

        stt.current.on("start", () => {
          console.log("start :>> ");
        });

        stt.current.on("end", () => {
          console.log("end :>> ");
        });

        stt.current.on("result", handleSTTResult);

        stt.current.on("error", (error) => {
          console.log("error :>> ", error);
          switch (error) {
            case "not-allowed":
              alert("마이크 권한이 필요합니다.");
              break;
            default:
              console.log(error);
          }
        });

        // 오디오가 활성화 상태일 때 stt 실행
        if (userStream.current.getAudioTracks()[0].enabled) {
          startSTT();
        }
        // STT 초기화 ============================================

        socket.emit("BE-join-room", { roomId, userName: currentUser });
        socket.on("FE-user-join", (users) => {
          // all users
          const peers = [];
          users.forEach(({ userId, info }) => {
            let { userName, video, audio } = info;

            if (userName !== currentUser) {
              const peer = createPeer(userId, socket.id, stream);

              peer.userName = userName;
              peer.peerID = userId;

              peersRef.current.push({
                peerID: userId,
                peer,
                userName,
              });
              peers.push(peer);

              setUserVideoAudio((preList) => {
                return {
                  ...preList,
                  [peer.userName]: { video, audio },
                };
              });
            }
          });
          setPeers(peers);
        });

        socket.on("FE-receive-call", ({ signal, from, info }) => {
          let { userName, video, audio } = info;
          const peerIdx = findPeer(from);

          if (!peerIdx) {
            const peer = addPeer(signal, from, stream);

            peer.userName = userName;

            peersRef.current.push({
              peerID: from,
              peer,
              userName: userName,
            });
            setPeers((users) => {
              return [...users, peer];
            });
            setUserVideoAudio((preList) => {
              return {
                ...preList,
                [peer.userName]: { video, audio },
              };
            });
          }
        });

        socket.on("FE-call-accepted", ({ signal, answerId }) => {
          const peerIdx = findPeer(answerId);
          peerIdx.peer.signal(signal);
        });

        socket.on("FE-user-leave", ({ userId, userName }) => {
          const peerIdx = findPeer(userId);
          peerIdx.peer.destroy();
          setPeers((users) => {
            users = users.filter((user) => user.peerID !== peerIdx.peer.peerID);
            return [...users];
          });
          peersRef.current = peersRef.current.filter(
            ({ peerID }) => peerID !== userId
          );
        });
      });

    socket.on("FE-toggle-camera", ({ userId, switchTarget }) => {
      const peerIdx = findPeer(userId);

      setUserVideoAudio((preList) => {
        let video = preList[peerIdx.userName].video;
        let audio = preList[peerIdx.userName].audio;

        if (switchTarget === "video") video = !video;
        else audio = !audio;

        return {
          ...preList,
          [peerIdx.userName]: { video, audio },
        };
      });
    });

    return () => {
      socket.disconnect();
      stopSTT();
    };
    // eslint-disable-next-line
  }, []);

  function createPeer(userId, caller, stream) {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socket.emit("BE-call-user", {
        userToCall: userId,
        from: caller,
        signal,
      });
    });
    peer.on("disconnect", () => {
      peer.destroy();
    });

    return peer;
  }

  function addPeer(incomingSignal, callerId, stream) {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socket.emit("BE-accept-call", { signal, to: callerId });
    });

    peer.on("disconnect", () => {
      peer.destroy();
    });

    peer.signal(incomingSignal);

    return peer;
  }

  function findPeer(id) {
    return peersRef.current.find((p) => p.peerID === id);
  }

  function createUserVideo(peer, index, arr) {
    return (
      <VideoBox key={index} onClick={expandScreen}>
        {writeUserName(peer.userName)}
        <FaIcon className="fas fa-expand" />
        {userVideoAudio[peer.userName] &&
          !userVideoAudio[peer.userName].audio && (
            <FaIconMicMute className="fas fa-microphone-slash" />
          )}
        <VideoCard key={index} peer={peer} number={arr.length} />
      </VideoBox>
    );
  }

  function writeUserName(userName, index) {
    if (userVideoAudio.hasOwnProperty(userName)) {
      if (!userVideoAudio[userName].video) {
        return <OffUserName key={userName}>{userName}</OffUserName>;
      } else {
        return <OnUserName key={userName}>{userName}</OnUserName>;
      }
    }
  }

  // stopButton
  const handleStop = () => {
    console.log("Stopping the session and navigating to the main page");

    window.location.href = "/";
  };

  // ==============================STT=======================================
  const [finalScript, setFinalScript] = useState("");
  const [previousFinalScript, setPreviousFinalScript] = useState("");

  const handleSTTResult = ({ finalTranscript, interimTranscript }) => {
    console.log("result :>> ", finalTranscript, interimTranscript);
    setFinalScript(finalTranscript);
  };

  useEffect(() => {
    if (finalScript !== "" && finalScript !== previousFinalScript) {
      socket.emit("BE-stt-data-out", {
        roomId,
        ssender: currentUser,
        smsg: finalScript,
        prev: previousFinalScript,
        timestamp: new Date().toISOString(),
      });
      setPreviousFinalScript(finalScript);
      console.log(finalScript);
      setFinalScript("");
    }
  }, [finalScript, currentUser, roomId]);

  const [getSub, setGetSub] = useState("");

  useEffect(() => {
    socket.on("FE-stt-sender", ({ ssender, smsg }) => {
      setGetSub((msgs) => [...msgs, { ssender, smsg }]);
      console.log("get >>", ssender, smsg);
    });
  }, []);

  const startSTT = () => {
    if (stt.current) {
      stopSTT(); // stt가 실행중이면 종료하고 다시 시작
      try {
        stt.current.start();
      } catch (error) {
        console.log("Error starting STT: ", error);
      }
    }
  };

  const stopSTT = () => {
    if (stt.current && stt.current.getIsRecognizing()) {
      try {
        stt.current.stop();
      } catch (error) {
        console.log("Error stopping STT: ", error);
      }
    }
  };

  // ==============================STT=======================================

  const toggleCameraAudio = (e) => {
    const target = e.target.getAttribute("data-switch");

    setUserVideoAudio((preList) => {
      let videoSwitch = preList["localUser"].video;
      let audioSwitch = preList["localUser"].audio;
      console.log(audioSwitch);

      if (target === "video") {
        const userVideoTrack =
          userVideoRef.current.srcObject.getVideoTracks()[0];
        videoSwitch = !videoSwitch;
        userVideoTrack.enabled = videoSwitch;
      } else {
        const userAudioTrack =
          userVideoRef.current.srcObject.getAudioTracks()[0];
        audioSwitch = !audioSwitch;

        if (userAudioTrack) {
          userAudioTrack.enabled = audioSwitch;
        } else {
          userStream.current.getAudioTracks()[0].enabled = audioSwitch;
        }
      }

      // 마이크 상태에 따라 stt 활성/비활성
      if (audioSwitch) {
        startSTT();
      } else {
        stopSTT();
      }

      return {
        ...preList,
        localUser: { video: videoSwitch, audio: audioSwitch },
      };
    });
    socket.emit("BE-toggle-camera-audio", { roomId, switchTarget: target });
  };

  const clickScreenSharing = () => {
    if (!screenShare) {
      navigator.mediaDevices
        .getDisplayMedia({ cursor: true })
        .then((stream) => {
          const screenTrack = stream.getTracks()[0];

          peersRef.current.forEach(({ peer }) => {
            // replaceTrack (oldTrack, newTrack, oldStream);
            peer.replaceTrack(
              peer.streams[0]
                .getTracks()
                .find((track) => track.kind === "video"),
              screenTrack,
              userStream.current
            );
          });

          // Listen click end
          screenTrack.onended = () => {
            peersRef.current.forEach(({ peer }) => {
              peer.replaceTrack(
                screenTrack,
                peer.streams[0]
                  .getTracks()
                  .find((track) => track.kind === "video"),
                userStream.current
              );
            });
            userVideoRef.current.srcObject = userStream.current;
            setScreenShare(false);
          };

          userVideoRef.current.srcObject = stream;
          screenTrackRef.current = screenTrack;
          setScreenShare(true);
        });
    } else {
      screenTrackRef.current.onended();
    }
  };

  const expandScreen = () => {
    if (userVideoRef.current) {
      const videoBox = userVideoRef.current.parentNode;

      videoBox.classList.add("fullscreen-mode");

      if (userVideoRef.current.requestFullscreen) {
        userVideoRef.current.requestFullscreen();
      } else if (userVideoRef.current.webkitRequestFullscreen) {
        // Safari
        userVideoRef.current.webkitRequestFullscreen();
      } else if (userVideoRef.current.mozRequestFullScreen) {
        // Firefox
        userVideoRef.current.mozRequestFullScreen();
      } else if (userVideoRef.current.msRequestFullscreen) {
        // IE/Edge
        userVideoRef.current.msRequestFullscreen();
      }
    }
  };

  const clickBackground = () => {
    if (!showVideoDevices) return;

    setShowVideoDevices(false);
  };

  const clickCameraDevice = (event) => {
    if (
      event &&
      event.target &&
      event.target.dataset &&
      event.target.dataset.value
    ) {
      const deviceId = event.target.dataset.value;
      const enabledAudio =
        userVideoRef.current.srcObject.getAudioTracks()[0].enabled;

      navigator.mediaDevices
        .getUserMedia({ video: { deviceId }, audio: enabledAudio })
        .then((stream) => {
          const newStreamTrack = stream
            .getTracks()
            .find((track) => track.kind === "video");
          const oldStreamTrack = userStream.current
            .getTracks()
            .find((track) => track.kind === "video");

          userStream.current.removeTrack(oldStreamTrack);
          userStream.current.addTrack(newStreamTrack);

          peersRef.current.forEach(({ peer }) => {
            // replaceTrack (oldTrack, newTrack, oldStream);
            peer.replaceTrack(
              oldStreamTrack,
              newStreamTrack,
              userStream.current
            );
          });
        });
    }
  };

  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState([
    { from: "bot", text: "무엇이든 물어보세요!" },
  ]);
  const [isRagEnabled, setIsRagEnabled] = useState(false);
  const endOfMessagesRef = useRef(null);

  const handleSendMessage = async () => {
    if (inputValue.trim() === "") return;

    const userMessage = { from: "user", text: inputValue };
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    // RAG
    let botResponse;

    // RAG 활성화 -> Flask 서버에 요청
    if (isRagEnabled) {
      try {
        const response = await fetch(`http://localhost:8000/rag_search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: inputValue }),
        });
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await response.json();
        botResponse = data.answer;
      } catch (error) {
        botResponse = "문제를 처리하는 중 오류가 발생했습니다.";
      }
    } else {
      botResponse = await fetchChatbotResponse(inputValue);
    }

    const botMessage = { from: "bot", text: botResponse };

    setMessages((prevMessages) => [...prevMessages, botMessage]);
    setInputValue("");
  };

  // RAG GPT

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <RoomContainer onClick={clickBackground}>
      <VideoAndChatContainer>
        <Dialog
          display={true}
          finalTranscript={finalScript}
          sender={currentUser}
        />
        <VideoContainer>
          <VideoGroup peerCount={peers.length + 1}>
            {" "}
            {/* 본인 포함 */}
            <VideoBox>
              {userVideoAudio["localUser"].video ? (
                <OnUserName>{currentUser}</OnUserName>
              ) : (
                <OffUserName>{currentUser}</OffUserName>
              )}
              <FaIcon className="fas fa-expand" />
              {!userVideoAudio["localUser"].audio && (
                <FaIconMicMute className="fas fa-microphone-slash" />
              )}
              <MyVideo
                onClick={expandScreen}
                ref={userVideoRef}
                muted
                autoPlay
                playInline
              />
            </VideoBox>
            {peers &&
              peers.map((peer, index, arr) =>
                createUserVideo(peer, index, arr)
              )}
          </VideoGroup>
        </VideoContainer>
        <Chat roomId={roomId} display={true} />
      </VideoAndChatContainer>

      <BottomBar
        clickScreenSharing={clickScreenSharing}
        clickCameraDevice={clickCameraDevice}
        goToBack={handleStop}
        toggleCameraAudio={toggleCameraAudio}
        userVideoAudio={userVideoAudio["localUser"]}
        screenShare={screenShare}
        videoDevices={videoDevices}
        showVideoDevices={showVideoDevices}
        setShowVideoDevices={setShowVideoDevices}
        onChatButtonClick={toggleChatBubble}
      />

      {isChatBubbleVisible && (
        <ChatBubble
          messages={messages}
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleKeyPress={handleKeyPress}
          handleSendMessage={handleSendMessage}
          endOfMessagesRef={endOfMessagesRef}
          isRagEnabled={isRagEnabled}
          setIsRagEnabled={setIsRagEnabled}
        />
      )}
    </RoomContainer>
  );
};

// ChatBubble 컴포넌트 정의
const ChatBubble = ({
  messages,
  inputValue,
  setInputValue,
  handleKeyPress,
  handleSendMessage,
  endOfMessagesRef,
  isRagEnabled,
  setIsRagEnabled,
}) => {
  return (
    <ChatBubbleContainer>
      <ChatHeader>ChatGPT</ChatHeader>
      <ChatMessages>
        {messages.map((msg, index) => (
          <Message key={index} from={msg.from}>
            {msg.text}
          </Message>
        ))}
        <div ref={endOfMessagesRef} />
      </ChatMessages>
      {/*RAG 체크박스*/}
      <InputContainer>
        <label>
          <input
            type="checkbox"
            checked={isRagEnabled}
            onChange={() => setIsRagEnabled((prev) => !prev)}
          />
          RAG
        </label>
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="메시지를 입력하세요..."
        />
        <SendButton onClick={handleSendMessage}>전송</SendButton>
      </InputContainer>
    </ChatBubbleContainer>
  );
};

const ChatBubbleContainer = styled.div`
  position: absolute;
  bottom: 81px;
  right: 210px;
  width: 550px;

  padding: 10px;
  background-color: white;
  border: solid 1px black;
  border-radius: 10px;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.1);
  font-family: "NunitoMedium";
  z-index: 10;

  &::after {
    content: "";
    position: absolute;
    top: 100%;
    right: 72%;
    border-width: 16px;
    border-style: solid;
    border-color: white transparent transparent transparent;
    transform: translateX(50%);
  }
`;

const ChatHeader = styled.div`
  font-size: 18px;
  padding: 13px 5px;
  background-color: black;
  border-radius: 10px 10px 0 0;
  font-family: "NunitoExtraBold";
`;

const ChatMessages = styled.div`
  max-height: 550px;
  min-height: 200px;

  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
`;

const Message = styled.div`
  margin: 5px 0;
  border-radius: 15px;
  padding: 7px 10px;
  font-size: 15px;
  text-align: left;
  color: black;
  background-color: ${(props) =>
    props.from === "user" ? "#f7e191" : "#e1e1e1"};
  align-self: ${(props) => (props.from === "user" ? "flex-end" : "flex-start")};
  max-width: 70%;
`;

const InputContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 5px;
  border-top: 1px solid #ccc;

  > label {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    color: black;
    font-size: 11px;
    margin-right: 7px;
    margin-top: 7.5px;
    font-family: "NunitoBold";
  }
`;

const Input = styled.input`
  flex: 1;
  padding: 7px 5px;
  padding-left: 8px;
  border: 1px solid #ccc;
  border-radius: 5px;
  margin-right: 9px;
  margin-top: 5px;
`;

const SendButton = styled.button`
  margin-top: 5px;
  margin-left: 2px;
  padding: 5px 10px;
  background-color: #f7e191;
  color: black;
  border: none;
  border-radius: 5px;
  cursor: pointer;

  &:hover {
    filter: brightness(0.9);
  }
`;

const RoomContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(to bottom, black, white);
`;

const VideoAndChatContainer = styled.div`
  display: flex;
  flex: 1;
  width: 88%;
  height: 83vh;
  background-color: white;
  margin: 0px 80px 95px;
  padding: 10px;
  border-radius: 10px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15);
`;

const VideoContainer = styled.div`
  display: flex;
  position: relative;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  max-width: 100%;
  width: 65%;
  height: 100%;
  max-height: 100%;
  padding: 5px;
  gap: 10px;
`;

const VideoGroup = styled.div`
  display: grid;
  width: 100%;
  height: 100%;
  gap: 10px;

  ${({ peerCount }) => {
    if (peerCount === 1) {
      return `
        grid-template-columns: 1fr;
        grid-template-rows: 1fr;
        justify-items: center;
        align-items: center;
      `;
    } else if (peerCount === 2) {
      return `
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);
        justify-items: center;
        align-items: center;
        padding-top: 320px;
      `;
    } else if (peerCount === 3) {
      return `
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);
        padding: 40px 0px;
        
        > div:nth-child(3) {
          grid-column: 1 / -1;
          justify-self: center;
          width: 50%;
        }
      `;
    } else if (peerCount >= 4) {
      return `
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(2, 1fr);
        padding: 40px 0px;
      `;
    }
  }}
`;

const VideoBox = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: auto;
  aspect-ratio: 4 / 3; /* 비율 유지 */
  border-radius: 10px;
  overflow: hidden;
  max-width: 100%;
  max-height: 100%;

  min-width: 200px;
  min-height: 150px;

  > video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 10px;
  }

  :hover {
    > i {
      display: block;
    }
  }
`;

const MyVideo = styled.video``;

const OnUserName = styled.div`
  position: absolute;
  bottom: 10px;
  left: 13px;
  font-size: 20px;
  z-index: 2;
  opacity: 0.9;
  font-family: "NunitoMedium";
  background-color: rgba(0, 0, 0, 0.4);
  color: white;
  padding: 3px 9px;
  border-radius: 5px;
`;

const OffUserName = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: calc(20px + 5vmin);
  z-index: 2;
  font-family: "NunitoExtraBold";
  text-align: center;
`;

const FaIcon = styled.i`
  display: none;
  position: absolute;
  right: 15px;
  bottom: 12px;
  opacity: 0.8;
  z-index: 2;
`;

const FaIconMicMute = styled.i`
  position: absolute;
  right: 10px;
  top: 12px;
  font-size: 14px;
  color: rgb(251, 33, 117);
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  padding: 10px 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2;
`;

export default Room;
