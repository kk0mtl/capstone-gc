import React, { useCallback } from "react";
import styled from "styled-components";
import { useParams } from "react-router-dom";
import gptLogo from "./gptlogo.png";

const BottomBar = ({
  clickCameraDevice,
  goToBack,
  toggleCameraAudio,
  userVideoAudio,
  videoDevices,
  showVideoDevices,
  clickScreenSharing,
  screenShare,
  onChatButtonClick,
}) => {
  const { roomId } = useParams();
  const currentUser = sessionStorage.getItem("user");

  const handleDocsClick = useCallback(() => {
    const url = `https://ai-doc-4b6051adc54a.herokuapp.com/?userName=${currentUser}&roomId=${roomId}`;
    window.open(url, "_blank");
  }, []);

  return (
    <Bar>
      <Center>
        <CameraButton onClick={toggleCameraAudio} data-switch="video">
          <div>
            {userVideoAudio.video ? (
              <FaIcon className="fas fa-video"></FaIcon>
            ) : (
              <FaIcon className="fas fa-video-slash"></FaIcon>
            )}
          </div>
          카메라
        </CameraButton>
        {showVideoDevices && (
          <SwitchList>
            {videoDevices.length > 0 &&
              videoDevices.map((device) => {
                return (
                  <div
                    key={device.deviceId}
                    onClick={clickCameraDevice}
                    data-value={device.deviceId}
                  >
                    {device.label}
                  </div>
                );
              })}
            <div>Switch Camera</div>
          </SwitchList>
        )}
        <CameraButton onClick={toggleCameraAudio} data-switch="audio">
          <div>
            {userVideoAudio.audio ? (
              <FaIcon className="fas fa-microphone"></FaIcon>
            ) : (
              <FaIcon className="fas fa-microphone-slash"></FaIcon>
            )}
          </div>
          마이크
        </CameraButton>
        <ScreenButton onClick={clickScreenSharing}>
          <div>
            <FaIcon
              className={`fas fa-desktop ${screenShare ? "sharing" : ""}`}
            ></FaIcon>
          </div>
          화면 공유
        </ScreenButton>
        <DocumentButton onClick={handleDocsClick}>
          <div>
            <FaIcon className="fas fa-edit icon"></FaIcon>
          </div>
          DocAI
        </DocumentButton>
        <ChatButton onClick={onChatButtonClick}>
          <div>
            <img src={gptLogo} alt="ChatGPT Logo" />
          </div>
          챗봇
        </ChatButton>
        <StopButton onClick={goToBack}>
          <div>
            <FaIcon className="fas fa-sign-out-alt"></FaIcon>
          </div>
          나가기
        </StopButton>
      </Center>
    </Bar>
  );
};

const Bar = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 8%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: black;
  overflow: hidden;
`;

const Center = styled.div`
display: flex;
align-items: center;
justify-content: center;
gap: 15px;
margin-left: 75px;
`;

const CameraButton = styled.div`
  position: relative;
  width: 75px;
  border: none;
  font-size: 0.9375rem;
  padding: 5px;
  margin-top: 7px;

  :hover {
    opacity: 0.7;
    cursor: pointer;
  }

  * {
    pointer-events: none;
  }

  .fa-microphone-slash {
    color: rgb(251, 33, 117);
  }

  .fa-video-slash {
    color: rgb(251, 33, 117);
  }
`;

const SwitchList = styled.div`
  display: flex;
  flex-direction: column;
  position: absolute;
  top: -65.95px;
  left: 80px;
  background-color: #4ea1d3;
  color: white;
  padding-top: 5px;
  padding-right: 10px;
  padding-bottom: 5px;
  padding-left: 10px;
  text-align: left;

  > div {
    font-size: 0.85rem;
    padding: 1px;
    margin-bottom: 5px;

    :not(:last-child):hover {
      background-color: #77b7dd;
      cursor: pointer;
    }
  }

  > div:last-child {
    border-top: 1px solid white;
    cursor: context-menu !important;
  }
`;

const ScreenButton = styled.div`
  width: 75px;
  border: none;
  font-size: 0.9375rem;
  padding: 5px;
  margin-top: 7px;

  :hover {
    opacity: 0.7;
    cursor: pointer;
  }

  .sharing {
    color: rgb(251, 33, 117);
  }
`;

const DocumentButton = styled.div`
  font-family: "NunitoBold";
  width: 75px;
  border: none;
  font-size: 0.9375rem;
  padding: 5px;
  margin-top: 6px;

  :hover {
    opacity: 0.7;
    cursor: pointer;
  }

  * {
    pointer-events: none;
  }

  > div {
    margin-bottom: 2px;
  }
`;

const ChatButton = styled.div`
  position: relative;
  width: 75px;
  border: none;
  font-size: 0.9375rem;
  padding: 5px;
  margin-top: 5px;

  img {
    width: 28px;
    height: 28px;
    margin-bottom: -4px;
  }

  :hover {
    opacity: 0.7;
    cursor: pointer;
  }

  * {
    pointer-events: none;
  }
`;

const StopButton = styled.div`
width: 75px;
border: none;
font-size: 0.9375rem;
padding: 5px;
margin-top: 7px;

.fa-sign-out-alt {
  color: rgb(251, 33, 117);
}

:hover {
  opacity: 0.7;
  cursor: pointer;
}

* {
  pointer-events: none;
}
`;

const FaIcon = styled.i`
width: 30px;
font-size: calc(16px + 1vmin);
`;


export default BottomBar;