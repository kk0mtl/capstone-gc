import React, { useState, useEffect } from "react";
import styled from "styled-components";
import socket from "../../socket";
import PropTypes from "prop-types";

const Dialog = ({ display }) => {
  const [messages, setMessages] = useState([]); // subtitle 받아오기
  const [isModalOpen, setIsModalOpen] = useState(false); // 모달 창 가시성 상태
  const [translations, setTranslations] = useState({});
  const [summary, setSummary] = useState(""); // 요약 내용
  const [report, setReport] = useState(""); // 요약 내용
  const [topic, setTopic] = useState(""); // 주제
  const [time, setTime] = useState(""); // 회의 시간
  const [isLoading, setIsLoading] = useState(false); // 로딩 상태
  const [pdfBlob, setPdfBlob] = useState(null); // PDF 파일을 Blob으로 저장

  // const hostIP = 'capstonesmugroupchat.click/gpt';
  const hostIP = 'https://prawn-leading-sensibly.ngrok-free.app';

  //console.log("Current User: ", currentUser);

  useEffect(() => {
    // 소켓 이벤트 리스너 설정
    const handleNewMessage = (data) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    };

    socket.on("FE-stt-dialog", handleNewMessage);

    // 컴포넌트가 언마운트될 때 소켓 연결 해제
    return () => {
      socket.off("FE-stt-dialog", handleNewMessage);
    };
  }, []);


  const translateToEnglish = async (index, text) => {
    try {
      console.log(index, text);
      // const response = await fetch(`https://${hostIP}/translate`, {
      const response = await fetch(`${hostIP}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      const translatedText = data.translated_text;
      console.log(data, translatedText);

      setTranslations((prevTranslations) => ({
        ...prevTranslations,
        [index]: translatedText,
      }));
    } catch (error) {
      console.error("Error translating text:", error);
    }
  };

  const handleSummaryClick = async () => {
    setIsLoading(true);
    try {
      // const response = await fetch(`https://${hostIP}/summarize`, {
      const response = await fetch(`${hostIP}/summarize`, {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': '69420'
        },
      });

      console.log(response);

      const data = await response.json();
      console.log(data);

      // 서버에서 가져온 요약 내용을 상태에 저장
      setSummary(data.full_summary);
      setTopic(data.topic_response);
      setTime(data.timeRange);

      // PDF 생성 요청
      const pdfResponse = await fetch(`${hostIP}/generate_pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ currentUser: "사용자 이름 또는 ID" })
      });

      if (pdfResponse.ok) {
        // PDF Blob으로 저장
        const blob = await pdfResponse.blob();
        setPdfBlob(blob); // PDF 미리보기를 위해 Blob 저장
        setIsModalOpen(true); // 모달 창 열기
      } else {
        console.error("Error generating PDF:", await pdfResponse.json());
      }
    } catch (error) {
      console.error("Error fetching summary or generating PDF:", error);
    }
    setIsLoading(false);
  };

  const handleDownloadPdf = () => {
    if (pdfBlob) {
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meeting_report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <DialogContainer style={{ display: display ? "block" : "none" }}>
        <DialogHeader>Dialog</DialogHeader>
        <TranscriptList>
          {messages.map((message, index) => (
            <FinalTranscriptContainer key={index}>
              <div>{message.ssender} :</div>
              <p>{message.smsg}</p>
              <a onClick={() => translateToEnglish(index, message.smsg)}>
                번역
              </a>
              {translations[index] && (
                <TranslatedText>{translations[index]}</TranslatedText>
              )}
              <Timestamp>
                {new Date(message.timestamp).toLocaleString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </Timestamp>
            </FinalTranscriptContainer>
          ))}
        </TranscriptList>
        <SummaryButtonContainer>
          <SummaryButton onClick={handleSummaryClick} disabled={isLoading}>
            {isLoading ? "Loading..." : "Summary"}
          </SummaryButton>
        </SummaryButtonContainer>
      </DialogContainer>

      {isModalOpen && (
        <ModalOverlay>
          <ModalContent>
            <CloseButton onClick={handleCloseModal}>✖️</CloseButton>
            <ModalHeader>Summary</ModalHeader>
            <ModalBody>
              <ContentWrapper>
                <SummaryContainer>
                  <Topic>Topic : {topic}</Topic>
                  <SummaryText>
                    <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
                      {summary.split("\n").map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </SummaryText>
                </SummaryContainer>
                <IframeContainer>
                  {pdfBlob && (
                    <iframe
                      src={URL.createObjectURL(pdfBlob)}
                      width="100%"
                      height="500px"
                      title="PDF Preview"
                    />
                  )}
                </IframeContainer>
              </ContentWrapper>
            </ModalBody>
            <DownloadButton onClick={handleDownloadPdf}>
              PDF 다운로드
            </DownloadButton>
          </ModalContent>
        </ModalOverlay>
      )}
    </>
  );
};

Dialog.propTypes = {
  display: PropTypes.bool.isRequired,
};

// DialogContainer 스타일 정의
const DialogContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 25%;
  height: 100%;
  background-color: whitesmoke;
  transition: all 0.5s ease;
  border-radius: 10px;
  overflow: hidden;
  padding: 0 10px;
  position: relative;
`;

// DialogHeader 스타일 정의
const DialogHeader = styled.div`
  width: 100%;
  height: 8%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 10px;
  font-size: 20px;
  color: black;
  background-color: white;
  font-family: "NunitoExtraBold";
  border: 1.3px solid #999999;
  border-radius: 8px;
`;

// TranscriptList 스타일 정의
const TranscriptList = styled.div`
  width: 100%;
  height: calc(100% - 120px); /* 60px for header + 60px for button */
  overflow-y: auto;
  padding: 10px;
`;

// TranslatedText 스타일 정의
const TranslatedText = styled.p`
  grid-column: 2 / 4; /* TranslatedText를 두 번째와 세 번째 열에 걸쳐 배치 */
  margin-top: 5px;
  color: #00a6ed;
`;

// FinalTranscriptContainer 스타일 정의
const FinalTranscriptContainer = styled.div`
  display: grid;
  grid-template-columns: 40px 1fr 50px;
  grid-template-rows: auto auto;
  align-items: center;
  margin-top: 10px;
  margin-right: 13px;
  font-size: 15px;
  font-weight: 500;
  padding: 0 5px;

  > div {
    grid-column: 1 / 2;
    font-family: "NunitoExtraBold";
    color: gray;
    margin-right: 5px;
    text-align: left;
  }

  > p {
    grid-column: 2 / 3;
    font-family: "NunitoMedium";
    margin-left: 5px;
    color: black;
    text-align: left;
    word-break: break-word;
  }

  > a {
    grid-column: 3 / 4;
    background-color: #f0d264;
    color: black;
    padding: 5px;
    border-radius: 5px;
    text-align: center;
    text-decoration: none;
    margin-left: 5px;
    font-size: 12px;

    display: inline-block;
    border: 1px solid rgba(0, 0, 0, 0.21);
    border-bottom-color: rgba(0, 0, 0, 0.34);
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.15);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.34) inset,
      0 2px 0 -1px rgba(0, 0, 0, 0.13), 0 3px 0 -1px rgba(0, 0, 0, 0.08),
      0 2px 10px -1px rgba(0, 0, 0, 0.21);

    :hover {
      background-color: #ffb02e;
    }

    :active {
      top: 1px;
      border-color: rgba(0, 0, 0, 0.34) rgba(0, 0, 0, 0.21) rgba(0, 0, 0, 0.21);
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.89),
        0 1px rgba(0, 0, 0, 0.05) inset;
      position: relative;
    }
  }

  > ${TranslatedText} {
    grid-column: 2 / 4; /* TranslatedText를 두 번째와 세 번째 열에 걸쳐 배치 */
    margin-top: 5px;
    color: #00a6ed;
  }
`;

// Timestamp 스타일 정의
const Timestamp = styled.div`
  grid-column: 4 / 5;
  //justify-self: end;
  //margin-right: auto;
  font-size: 12px;
  color: gray;
  //text-align: left;
`;

const SummaryButtonContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  position: absolute; /* 절대 위치 */
  bottom: 0; /* 하단에 고정 */
  left: 1px;
  background-color: whitesmoke; /* 배경색 추가하여 버튼이 더 잘 보이게 함 */
`;

const SummaryButton = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 200px;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  margin: 20px;
  height: 55px;
  text-align: center;
  border: none;
  background-size: 300% 100%;
  font-family: "NunitoExtraBold";

  border-radius: 50px;
  transition: all 0.2s ease-in-out;

  :hover {
    background-position: 100% 0;
    transition: all 0.2s ease-in-out;
  }

  :focus {
    outline: none;
  }

  background-image: linear-gradient(
    to right,
    #29323c,
    #485563,
    #2b5876,
    #4e4376
  );
  box-shadow: 0 2px 10px 0 rgba(45, 54, 65, 0.75);
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 20px;
  border-radius: 10px;
  width: 60%;
  max-height: 60%;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: relative;
  color: black;
  overflow-y: auto;

  /* 스크롤바 숨기기 */
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none; /* IE 및 Edge */
  scrollbar-width: none; /* Firefox */
`;

const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;

  :hover {
    opacity: 0.6;
  }
`;

const ModalHeader = styled.h2`
  margin: 0;
  margin-bottom: 20px;
  font-family: "NunitoBlack";
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;

  /* 스크롤바 숨기기 */
  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none; /* IE 및 Edge */
  scrollbar-width: none; /* Firefox */
`;

const Topic = styled.div`
  font-size: 18px;
  margin-bottom: 10px;
  font-family: "NunitoBold";
  text-align: left;
`;

const ContentWrapper = styled.div`
  display: flex;
  gap: 20px;
`;

const SummaryContainer = styled.div`
  width: 40%;
`;

const SummaryText = styled.div`
  font-family: "NunitoMedium";
  font-size: 16px;
  text-align: left;
`;

const IframeContainer = styled.div`
  width: 60%;
  heigth: 90%;
`;

const DownloadButton = styled.button`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 200px;
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  background-color: #4e4376;
  border: none;
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  margin-top: 20px;
  align-self: center;
  :hover {
    background-color: #3a2d5e;
  }
`;
export default Dialog;