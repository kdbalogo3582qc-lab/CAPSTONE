import React, { useState, useEffect, useRef } from 'react';
import logo from '../../assets/logo.svg';
import Swal from 'sweetalert2';
import axios from 'axios';
import ApiConfig from '../config/LocalConfigApi';
import styled from 'styled-components';
import { HiChevronLeft, HiChevronRight, HiChevronUp, HiChevronDown } from 'react-icons/hi';
import { IoSend } from 'react-icons/io5';

function Rightbar({ user, analysisResult, onCollapseChange, isStreaming = false, resetKey = 0 }) {
  const conversationContainerRef = useRef(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSuggestionsCollapsed, setIsSuggestionsCollapsed] = useState(false);
  const INITIAL_CONVO = {
    messages: [
      {
        title: "AI Video Insights Assistant",
        response: "Hello! I can help you analyze video insights. Upload a video and select a topic from the suggestions above, or ask me anything about your video!",
      },
    ],
  };

  const [convo, setConvoState] = useState(() => {
    try {
      const stored = localStorage.getItem("rightbar_convo");
      return stored ? JSON.parse(stored) : INITIAL_CONVO;
    } catch { return INITIAL_CONVO; }
  });

  const setConvo = (updater) => {
    setConvoState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try { localStorage.setItem("rightbar_convo", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const [isLoading, setIsLoading] = useState(false);
  const [userInput, setUserInput] = useState('');

  // Reset convo when parent triggers a reset (resetKey increments)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setConvoState(INITIAL_CONVO);
    try { localStorage.removeItem("rightbar_convo"); } catch {}
  }, [resetKey]);

  // Scroll to the bottom of the conversation container whenever messages change
  useEffect(() => {
    if (conversationContainerRef.current) {
      conversationContainerRef.current.scrollTop = conversationContainerRef.current.scrollHeight;
    }
  }, [convo.messages]);

  // ✅ Notify parent component when collapse state changes
  useEffect(() => {
    if (onCollapseChange) {
      onCollapseChange(isCollapsed);
    }
  }, [isCollapsed, onCollapseChange]);

  const contents = [
    {
      title: 'Key Statistics',
      description: 'Extract any statistics mentioned in the video, such as numbers, percentages, etc.',
    },
    {
      title: 'Target Audience',
      description: 'Identify the target audience for the video. This could be based on the language, tone, or content of the video.',
    },
    {
      title: 'Key Points',
      description: 'Extract the key points made in the video. This could be a list of topics, ideas, or arguments.',
    },
    {
      title: 'Potential Improvements',
      description: 'Suggest potential improvements to the video. This could be based on the content, delivery, or presentation.',
    },
  ];

  const processResponse = async (title, description, analysisResult) => {
    try {
      const response = await axios.post(`${ApiConfig.apiURL}/processPrompt`, {
        title,
        description,
        analysisResult,
      });
      
      console.log('Raw prompt response:', response.data);
      
      return response.data;
      
    } catch (error) {
      console.error('Error in processResponse:', error);
      throw error;
    }
  };

  const processCustomPrompt = async (userPrompt, analysisResult) => {
    try {
      const response = await axios.post(`${ApiConfig.apiURL}/processPrompt`, {
        userPrompt,
        analysisResult,
      });
      
      console.log('Custom prompt response:', response.data);
      
      return response.data;
      
    } catch (error) {
      console.error('Error in processCustomPrompt:', error);
      throw error;
    }
  };

  const handleClick = async (content) => {
    if (analysisResult === null) {
      Swal.fire({
        icon: 'warning',
        title: 'No Analysis Available',
        text: 'Please analyze a video first before using the AI assistant!',
        confirmButtonColor: '#0284c7'
      });
      return;
    }

    // Add the clicked title to the conversation immediately
    setConvo((prevConvo) => ({
      messages: [
        ...prevConvo.messages,
        {
          title: content.title,
          response: null, // null indicates loading
        },
      ],
    }));

    setIsLoading(true);

    try {
      const responseData = await processResponse(content.title, content.description, analysisResult);
      console.log('Processed response:', responseData);

      // Update the conversation with the API response
      setConvo((prevConvo) => {
        const updatedMessages = prevConvo.messages.map((message, index) => {
          if (index === prevConvo.messages.length - 1) {
            // ✅ FIXED: Extract response based on your Python script's output format
            const responseText = typeof responseData === 'string' 
              ? responseData 
              : responseData.response || responseData.content || JSON.stringify(responseData, null, 2);
            
            return {
              ...message,
              response: responseText,
            };
          }
          return message;
        });

        return {
          messages: updatedMessages,
        };
      });
    } catch (error) {
      console.error('Error in handleClick:', error);
      
      // Update the conversation with error message
      setConvo((prevConvo) => {
        const updatedMessages = prevConvo.messages.map((message, index) => {
          if (index === prevConvo.messages.length - 1) {
            return {
              ...message,
              response: `Sorry, I encountered an error: ${error.response?.data?.error || error.message || 'Unknown error'}`,
            };
          }
          return message;
        });

        return {
          messages: updatedMessages,
        };
      });
      
      Swal.fire({
        icon: 'error',
        title: 'Processing Error',
        text: error.response?.data?.error || 'Failed to process your request. Please try again.',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // NEW: Handle custom user input
  const handleUserInputSubmit = async (e) => {
    e.preventDefault();
    
    if (!userInput.trim()) {
      return;
    }

    if (analysisResult === null) {
      Swal.fire({
        icon: 'warning',
        title: 'No Analysis Available',
        text: 'Please analyze a video first before asking questions!',
        confirmButtonColor: '#0284c7'
      });
      return;
    }

    const currentInput = userInput;
    setUserInput('');

    // Add user message to conversation
    setConvo((prevConvo) => ({
      messages: [
        ...prevConvo.messages,
        {
          title: currentInput,
          response: null, // null indicates loading
        },
      ],
    }));

    setIsLoading(true);

    try {
      const responseData = await processCustomPrompt(currentInput, analysisResult);
      console.log('Custom prompt response:', responseData);

      // Update the conversation with the API response
      setConvo((prevConvo) => {
        const updatedMessages = prevConvo.messages.map((message, index) => {
          if (index === prevConvo.messages.length - 1) {
            const responseText = responseData.response || 
                               responseData.content || 
                               (responseData.error ? `Error: ${responseData.error}` : JSON.stringify(responseData, null, 2));
            
            return {
              ...message,
              response: responseText,
            };
          }
          return message;
        });

        return {
          messages: updatedMessages,
        };
      });
    } catch (error) {
      console.error('Error in handleUserInputSubmit:', error);
      
      // Update the conversation with error message
      setConvo((prevConvo) => {
        const updatedMessages = prevConvo.messages.map((message, index) => {
          if (index === prevConvo.messages.length - 1) {
            return {
              ...message,
              response: `Sorry, I encountered an error: ${error.response?.data?.error || error.message || 'Unknown error'}`,
            };
          }
          return message;
        });

        return {
          messages: updatedMessages,
        };
      });
      
      Swal.fire({
        icon: 'error',
        title: 'Processing Error',
        text: error.response?.data?.error || 'Failed to process your request. Please try again.',
        confirmButtonColor: '#ef4444'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleSuggestionsCollapse = () => {
    setIsSuggestionsCollapsed(!isSuggestionsCollapsed);
  };

  return (
    <>
      {/* Desktop Rightbar */}
      <DesktopRightbar $isCollapsed={isCollapsed}>
        <CollapseButton 
          onClick={toggleCollapse}
          $isCollapsed={isCollapsed}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <HiChevronLeft size={20} /> : <HiChevronRight size={20} />}
        </CollapseButton>

        {!isCollapsed && (
          <RightbarContent>
            {!user ? (
              <LoadingPlaceholder>
                <LoadingDot /><LoadingDot /><LoadingDot />
              </LoadingPlaceholder>
            ) : (
            <>
            <HeaderSection>
              <HeaderTitleRow>
                <HeaderTitle>What can I help with?</HeaderTitle>
                <SuggestionsToggleButton
                  onClick={toggleSuggestionsCollapse}
                  aria-label={isSuggestionsCollapsed ? "Show suggestions" : "Hide suggestions"}
                  title={isSuggestionsCollapsed ? "Show suggestions" : "Hide suggestions"}
                >
                  {isSuggestionsCollapsed ? <HiChevronDown size={20} /> : <HiChevronUp size={20} />}
                </SuggestionsToggleButton>
              </HeaderTitleRow>
              <HeaderSubtitle>
                {analysisResult ? 'Select a topic to explore' : 'Analyze a video to get started'}
              </HeaderSubtitle>
            </HeaderSection>

            <SuggestionsWrapper $isCollapsed={isSuggestionsCollapsed}>
              <SuggestionsGrid>
                {contents.map((content, index) => (
                  <SuggestionCard
                    key={index}
                    onClick={() => handleClick(content)}
                    disabled={!analysisResult || isStreaming}
                    $isDisabled={!analysisResult || isStreaming}
                  >
                    <SuggestionTitle>{content.title}</SuggestionTitle>
                    <SuggestionDescription>{content.description}</SuggestionDescription>
                  </SuggestionCard>
                ))}
              </SuggestionsGrid>
            </SuggestionsWrapper>

            {/* Conversation Box */}
            <ConversationContainer ref={conversationContainerRef}>
              {convo.messages.map((message, index) => (
                <MessageGroup key={index}>
                  {/* User Message */}
                  <UserMessageWrapper>
                    <UserMessage>
                      {message.title}
                    </UserMessage>
                    <UserAvatar>
                      {user?.acc_email ? user.acc_email.substring(0, 2).toUpperCase() : 'U'}
                    </UserAvatar>
                  </UserMessageWrapper>

                  {/* AI Response */}
                  <AIMessageWrapper>
                    <AIAvatar>
                      <img src={logo} alt="AI Assistant" />
                    </AIAvatar>
                    <AIMessage>
                      {message.response === null ? (
                        <TypingIndicator>
                          <div className="typing-circle" />
                          <div className="typing-circle" />
                          <div className="typing-circle" />
                          <div className="typing-shadow" />
                          <div className="typing-shadow" />
                          <div className="typing-shadow" />
                        </TypingIndicator>
                      ) : (
                        <MessageContent
                          dangerouslySetInnerHTML={{ __html: message.response }}
                        />
                      )}
                    </AIMessage>
                  </AIMessageWrapper>
                </MessageGroup>
              ))}
            </ConversationContainer>

            {/* Processing notice */}
            {isStreaming && (
              <ProcessingNotice>
                <ProcessingDot /><ProcessingDot /><ProcessingDot />
                <span>Video is being analyzed — chat will be available shortly</span>
              </ProcessingNotice>
            )}

            {/* NEW: Input Form */}
            <InputForm onSubmit={handleUserInputSubmit}>
              <InputWrapper>
                <StyledInput
                  type="text"
                  placeholder={isStreaming ? "Video is being processed..." : analysisResult ? "Ask me anything about your video..." : "Analyze a video first"}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  disabled={!analysisResult || isLoading || isStreaming}
                />
                <SendButton 
                  type="submit" 
                  disabled={!analysisResult || isLoading || !userInput.trim() || isStreaming}
                  $isDisabled={!analysisResult || isLoading || !userInput.trim() || isStreaming}
                >
                  <IoSend size={18} />
                </SendButton>
              </InputWrapper>
            </InputForm>
            </>
            )}
          </RightbarContent>
        )}
      </DesktopRightbar>

      {/* Mobile Toggle Button */}
      <MobileToggleButton 
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle AI assistant"
      >
        <HiChevronLeft size={24} className={isMobileOpen ? 'rotate' : ''} />
      </MobileToggleButton>

      {/* Mobile Rightbar */}
      {isMobileOpen && (
        <>
          <MobileBackdrop onClick={() => setIsMobileOpen(false)} />
          <MobileRightbar>
            <RightbarContent>
              <HeaderSection>
                <HeaderTitleRow>
                  <HeaderTitle>What can I help with?</HeaderTitle>
                  <SuggestionsToggleButton
                    onClick={toggleSuggestionsCollapse}
                    aria-label={isSuggestionsCollapsed ? "Show suggestions" : "Hide suggestions"}
                    title={isSuggestionsCollapsed ? "Show suggestions" : "Hide suggestions"}
                  >
                    {isSuggestionsCollapsed ? <HiChevronDown size={20} /> : <HiChevronUp size={20} />}
                  </SuggestionsToggleButton>
                </HeaderTitleRow>
                <HeaderSubtitle>
                  {analysisResult ? 'Select a topic to explore' : 'Analyze a video to get started'}
                </HeaderSubtitle>
              </HeaderSection>

              <SuggestionsWrapper $isCollapsed={isSuggestionsCollapsed}>
                <SuggestionsGrid>
                  {contents.map((content, index) => (
                    <SuggestionCard
                      key={index}
                      onClick={() => {
                        handleClick(content);
                      }}
                      disabled={!analysisResult || isStreaming}
                      $isDisabled={!analysisResult || isStreaming}
                    >
                      <SuggestionTitle>{content.title}</SuggestionTitle>
                      <SuggestionDescription>{content.description}</SuggestionDescription>
                    </SuggestionCard>
                  ))}
                </SuggestionsGrid>
              </SuggestionsWrapper>

              {/* Conversation Box */}
              <ConversationContainer ref={conversationContainerRef}>
                {convo.messages.map((message, index) => (
                  <MessageGroup key={index}>
                    {/* User Message */}
                    <UserMessageWrapper>
                      <UserMessage>
                        {message.title}
                      </UserMessage>
                      <UserAvatar>
                        {/* ✅ FIXED: Safe access to user email */}
                        {user?.acc_email ? user.acc_email.substring(0, 2).toUpperCase() : 'U'}
                      </UserAvatar>
                    </UserMessageWrapper>

                    {/* AI Response */}
                    <AIMessageWrapper>
                      <AIAvatar>
                        <img src={logo} alt="AI Assistant" />
                      </AIAvatar>
                      <AIMessage>
                        {message.response === null ? (
                          <TypingIndicator>
                            <div className="typing-circle" />
                            <div className="typing-circle" />
                            <div className="typing-circle" />
                            <div className="typing-shadow" />
                            <div className="typing-shadow" />
                            <div className="typing-shadow" />
                          </TypingIndicator>
                        ) : (
                          <MessageContent
                            dangerouslySetInnerHTML={{ __html: message.response }}
                          />
                        )}
                      </AIMessage>
                    </AIMessageWrapper>
                  </MessageGroup>
                ))}
              </ConversationContainer>

              {/* NEW: Input Form for Mobile */}
              <InputForm onSubmit={handleUserInputSubmit}>
                <InputWrapper>
                  <StyledInput
                    type="text"
                    placeholder={isStreaming ? "Video is being processed..." : analysisResult ? "Ask me anything about your video..." : "Analyze a video first"}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    disabled={!analysisResult || isLoading || isStreaming}
                  />
                  <SendButton 
                    type="submit" 
                    disabled={!analysisResult || isLoading || !userInput.trim() || isStreaming}
                    $isDisabled={!analysisResult || isLoading || !userInput.trim() || isStreaming}
                  >
                    <IoSend size={18} />
                  </SendButton>
                </InputWrapper>
              </InputForm>
            </RightbarContent>
          </MobileRightbar>
        </>
      )}
    </>
  );
}

// Styled Components
const DesktopRightbar = styled.div`
  width: ${props => props.$isCollapsed ? '48px' : '380px'};
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: fixed;
  top: 64px;
  right: 0;
  bottom: 0;
  background: white;
  border-left: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 40;

  @media (max-width: 1024px) {
    display: none;
  }
`;

const CollapseButton = styled.button`
  position: absolute;
  left: ${props => props.$isCollapsed ? '8px' : '20px'};
  top: 22px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: white;
  border: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 50;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  &:hover {
    background: #f9fafb;
    border-color: #0284c7;
    color: #0284c7;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const MobileToggleButton = styled.button`
  display: none;
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #075985 0%, #0284c7 100%);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
  cursor: pointer;
  z-index: 50;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;

  .rotate {
    transform: rotate(180deg);
  }

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(2, 132, 199, 0.5);
  }

  @media (max-width: 1024px) {
    display: flex;
  }
`;

const MobileBackdrop = styled.div`
  display: none;
  position: fixed;
  top: 64px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 44;
  animation: fadeIn 0.3s ease-out;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (max-width: 1024px) {
    display: block;
  }
`;

const MobileRightbar = styled.div`
  width: 90%;
  max-width: 380px;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
  position: fixed;
  top: 64px;
  right: 0;
  bottom: 0;
  background: white;
  border-radius: 12px 0 0 0;
  padding: 16px;
  overflow-y: auto;
  z-index: 45;
  animation: slideInRight 0.3s ease-out;

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }
`;

const RightbarContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding-top: 40px;
`;

const HeaderSection = styled.div`
  text-align: center;
  padding: 16px 0 8px 0;
`;

const HeaderTitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const HeaderTitle = styled.h1`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;

  @media (max-width: 768px) {
    font-size: 1.125rem;
  }
`;

const SuggestionsToggleButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: white;
  border: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  color: #6b7280;

  &:hover {
    background: #f9fafb;
    border-color: #0284c7;
    color: #0284c7;
  }

  &:active {
    transform: scale(0.95);
  }
`;

const HeaderSubtitle = styled.p`
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
`;

const SuggestionsWrapper = styled.div`
  max-height: ${props => props.$isCollapsed ? '0' : '200px'};
  overflow: auto;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
`;

const SuggestionsGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0 16px;
  overflow-y: auto;
`;

const SuggestionCard = styled.button`
  background: ${props => props.$isDisabled ? 'rgba(243, 244, 246, 0.4)' : 'rgba(243, 244, 246, 0.6)'};
  cursor: ${props => props.$isDisabled ? 'not-allowed' : 'pointer'};
  padding: 12px 16px;
  border-radius: 10px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  text-align: left;
  opacity: ${props => props.$isDisabled ? 0.6 : 1};

  &:hover:not(:disabled) {
    background: rgba(219, 234, 254, 0.6);
    border-color: rgba(2, 132, 199, 0.2);
    transform: translateY(-2px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

const SuggestionTitle = styled.div`
  font-size: 0.9375rem;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4px;
`;

const SuggestionDescription = styled.div`
  font-size: 0.75rem;
  line-height: 1.5;
  color: #6b7280;
  font-weight: 300;
`;

const ConversationContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #d1d5db;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #9ca3af;
  }
`;

const MessageGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 24px;
`;

const UserMessageWrapper = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: flex-start;
`;

const UserMessage = styled.div`
  background: #0284c7;
  color: white;
  padding: 12px 16px;
  border-radius: 12px 12px 4px 12px;
  font-size: 0.875rem;
  max-width: 80%;
  word-wrap: break-word;
  box-shadow: 0 2px 4px rgba(2, 132, 199, 0.2);
`;

const UserAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #075985 0%, #0284c7 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const AIMessageWrapper = styled.div`
  display: flex;
  gap: 8px;
  align-items: flex-start;
`;

const AIAvatar = styled.div`
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  img {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }
`;

const AIMessage = styled.div`
  background: #f3f4f6;
  color: #4b5563;
  padding: 12px 16px;
  border-radius: 12px 12px 12px 4px;
  font-size: 0.875rem;
  max-width: 80%;
  word-wrap: break-word;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
`;

const MessageContent = styled.div`
  line-height: 1.6;
  
  p {
    margin: 0 0 8px 0;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  ul, ol {
    margin: 8px 0;
    padding-left: 20px;
  }
  
  li {
    margin: 4px 0;
  }
`;

const TypingIndicator = styled.div`
  width: 60px;
  height: 30px;
  position: relative;

  .typing-circle {
    width: 8px;
    height: 8px;
    position: absolute;
    border-radius: 50%;
    background-color: #6b7280;
    left: 15%;
    transform-origin: 50%;
    animation: typing-circle7124 0.5s alternate infinite ease;
  }

  @keyframes typing-circle7124 {
    0% {
      top: 20px;
      height: 5px;
      border-radius: 50px 50px 25px 25px;
      transform: scaleX(1.7);
    }
    40% {
      height: 8px;
      border-radius: 50%;
      transform: scaleX(1);
    }
    100% {
      top: 0%;
    }
  }

  .typing-circle:nth-child(2) {
    left: 45%;
    animation-delay: 0.2s;
  }

  .typing-circle:nth-child(3) {
    left: auto;
    right: 15%;
    animation-delay: 0.3s;
  }

  .typing-shadow {
    width: 5px;
    height: 4px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.2);
    position: absolute;
    top: 30px;
    transform-origin: 50%;
    left: 15%;
    filter: blur(1px);
    animation: typing-shadow046 0.5s alternate infinite ease;
  }

  @keyframes typing-shadow046 {
    0% {
      transform: scaleX(1.5);
    }
    40% {
      transform: scaleX(1);
      opacity: 0.7;
    }
    100% {
      transform: scaleX(0.2);
      opacity: 0.4;
    }
  }

  .typing-shadow:nth-child(4) {
    left: 45%;
    animation-delay: 0.2s;
  }

  .typing-shadow:nth-child(5) {
    left: auto;
    right: 15%;
    animation-delay: 0.3s;
  }
`;

const InputForm = styled.form`
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
`;

const InputWrapper = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const StyledInput = styled.input`
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 0.875rem;
  outline: none;
  transition: all 0.2s;

  &:focus {
    border-color: #0284c7;
    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.1);
  }

  &:disabled {
    background: #f9fafb;
    cursor: not-allowed;
    color: #9ca3af;
  }

  &::placeholder {
    color: #9ca3af;
  }
`;

const SendButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: ${props => props.$isDisabled ? '#e5e7eb' : 'linear-gradient(135deg, #075985 0%, #0284c7 100%)'};
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ${props => props.$isDisabled ? 'not-allowed' : 'pointer'};
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(2, 132, 199, 0.3);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.5;
  }
`;

const LoadingPlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1;
`;

const LoadingDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0284c7;
  opacity: 0.5;
  animation: pulse 1.2s ease-in-out infinite;

  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.4s; }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50%       { opacity: 1;   transform: scale(1.1); }
  }
`;

const ProcessingNotice = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  margin-bottom: 10px;
  font-size: 0.78rem;
  color: #1d4ed8;
  font-weight: 500;
  line-height: 1.4;
`;

const ProcessingDot = styled.div`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0284c7;
  flex-shrink: 0;
  animation: processPulse 1.2s ease-in-out infinite;
  &:nth-child(2) { animation-delay: 0.2s; }
  &:nth-child(3) { animation-delay: 0.4s; margin-right: 4px; }

  @keyframes processPulse {
    0%, 100% { opacity: 0.3; transform: scale(0.8); }
    50%       { opacity: 1;   transform: scale(1.1); }
  }
`;

export default Rightbar;