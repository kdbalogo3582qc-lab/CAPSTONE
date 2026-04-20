import React, { useState } from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";
import { HiMenuAlt3 } from "react-icons/hi";
import { FiArrowRight, FiCheckCircle, FiBarChart2, FiTarget, FiMessageSquare } from "react-icons/fi";
import Navbar from "./Navbar";
import Leftbar from "./Leftbar";
import { useAuth } from "./Login";
import step1Image from "../../assets/step-1.avif";
import step2Image from "../../assets/step-2.avif";
import step3Image from "../../assets/step-3.avif";
import step4Image from "../../assets/step-4.avif";
import AI from "../../assets/AI.avif";

const PROCESS_STEPS = [
    {
        number: 1,
        title: "Upload Your Video",
        description:
            "Drag and drop your presentation or ad creative. Supported formats are optimized automatically for analysis.",
        image: step1Image,
    },
    {
        number: 2,
        title: "Start AI Analysis",
        description:
            "Run the analyzer to process transcript, delivery quality, pacing, and audience-oriented signals in one flow.",
        image: step2Image,
    },
    {
        number: 3,
        title: "Review Structured Results",
        description:
            "Get a clear breakdown of summary, impact, emotional profile, and content effectiveness in dashboard panels.",
        image: step3Image,
    },
    {
        number: 4,
        title: "Apply Recommendations",
        description:
            "Use actionable suggestions to improve weak sections, then iterate with another run for measurable progress.",
        image: step4Image,
    },
];

const FEATURE_CARDS = [
    {
        id: 1,
        title: "Performance Metrics",
        text: "Track clarity score, speaking pace, tone stability, and quality indicators in a single view.",
        icon: <FiBarChart2 size={20} />,
    },
    {
        id: 2,
        title: "Audience Fit",
        text: "Understand likely audience resonance and where message delivery can be sharpened.",
        icon: <FiTarget size={20} />,
    },
    {
        id: 3,
        title: "Message Extraction",
        text: "Identify your strongest talking points and segments that may need restructuring.",
        icon: <FiMessageSquare size={20} />,
    },
];

function HowItWorks() {
    const { user } = useAuth();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [activeStep, setActiveStep] = useState(1);

    return (
        <PageShell>
            <Navbar user={user} activePath="/how-it-works" />
            <Leftbar
                isMobileMenuOpen={isMobileSidebarOpen}
                closeMobileMenu={() => setIsMobileSidebarOpen(false)}
            />

            <MobileMenuButton onClick={() => setIsMobileSidebarOpen(true)}>
                <HiMenuAlt3 size={24} />
            </MobileMenuButton>

            <MainArea>
                <ContentWrapper>
                    <HeroCard>
                        <HeroLabel>Product Walkthrough</HeroLabel>
                        <HeroTitle>How Video Analyzer Works</HeroTitle>
                        <HeroText>
                            A streamlined workflow from upload to insight. Designed for creators, teams, and reviewers
                            who need fast, reliable feedback on video effectiveness.
                        </HeroText>
                        <HeroActions>
                            <PrimaryLink to="/home">
                                Start Analyzing
                                <FiArrowRight size={16} />
                            </PrimaryLink>
                            <SecondaryLink to="/faqs">View FAQs</SecondaryLink>
                        </HeroActions>
                    </HeroCard>

                    <SectionHeader>
                        <h2>4-Step Workflow</h2>
                        <p>Each step is designed to reduce manual review time and improve presentation quality.</p>
                    </SectionHeader>

                    <StepsGrid>
                        {PROCESS_STEPS.map((step) => {
                            const isActive = activeStep === step.number;
                            return (
                                <StepCard
                                    key={step.number}
                                    $active={isActive}
                                    onMouseEnter={() => setActiveStep(step.number)}
                                >
                                    <StepImageWrap>
                                        <StepImage src={step.image} alt={`Step ${step.number} ${step.title}`} />
                                        <StepNumber>{step.number}</StepNumber>
                                    </StepImageWrap>
                                    <StepBody>
                                        <StepTitle>{step.title}</StepTitle>
                                        <StepText>{step.description}</StepText>
                                    </StepBody>
                                </StepCard>
                            );
                        })}
                    </StepsGrid>

                    <SectionHeader>
                        <h2>Insight Modules</h2>
                        <p>Core analysis areas included in each report.</p>
                    </SectionHeader>

                    <FeatureGrid>
                        {FEATURE_CARDS.map((feature) => (
                            <FeatureCard key={feature.id}>
                                <FeatureIcon>{feature.icon}</FeatureIcon>
                                <h3>{feature.title}</h3>
                                <p>{feature.text}</p>
                            </FeatureCard>
                        ))}
                    </FeatureGrid>

                    <ShowcasePanel>
                        <ShowcaseMedia>
                            <img src={AI} alt="Video analysis dashboard" />
                        </ShowcaseMedia>

                        <ShowcaseContent>
                            <h3>What you get after each run</h3>
                            <Checklist>
                                <li>
                                    <FiCheckCircle size={16} />
                                    Concise summary and key points
                                </li>
                                <li>
                                    <FiCheckCircle size={16} />
                                    Audience and emotional signal overview
                                </li>
                                <li>
                                    <FiCheckCircle size={16} />
                                    Prioritized recommendations for improvement
                                </li>
                                <li>
                                    <FiCheckCircle size={16} />
                                    Saved history for performance tracking
                                </li>
                            </Checklist>

                            <PrimaryLink to="/home">
                                Open Dashboard
                                <FiArrowRight size={16} />
                            </PrimaryLink>
                        </ShowcaseContent>
                    </ShowcasePanel>
                </ContentWrapper>
            </MainArea>
        </PageShell>
    );
}

export default HowItWorks;

const PageShell = styled.div`
    min-height: 100vh;
    background: #f9fafb;
`;

const MainArea = styled.main`
    margin-left: 230px;
    margin-top: 68px;
    min-height: calc(100vh - 68px);
    padding: 24px;

    @media (max-width: 1024px) {
        margin-left: 0;
        margin-top: 64px;
        padding: 16px;
    }
`;

const MobileMenuButton = styled.button`
    display: none;

    @media (max-width: 1024px) {
        display: grid;
        place-items: center;
        position: fixed;
        top: 78px;
        left: 16px;
        width: 40px;
        height: 40px;
        border-radius: 10px;
        border: 1px solid #e5e7eb;
        background: white;
        color: #1f2937;
        z-index: 60;
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
    }
`;

const ContentWrapper = styled.div`
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
`;

const HeroCard = styled.section`
    background: linear-gradient(140deg, #ffffff 0%, #ecfeff 100%);
    border: 1px solid #bae6fd;
    border-radius: 18px;
    padding: 24px;
    box-shadow: 0 14px 30px rgba(2, 132, 199, 0.09);
`;

const HeroLabel = styled.span`
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: #e0f2fe;
    color: #0369a1;
    font-size: 0.74rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
`;

const HeroTitle = styled.h1`
    margin-top: 12px;
    font-size: clamp(1.4rem, 2.2vw, 1.9rem);
    color: #0f172a;
`;

const HeroText = styled.p`
    margin-top: 8px;
    max-width: 70ch;
    color: #475569;
    line-height: 1.65;
    font-size: 0.95rem;
`;

const HeroActions = styled.div`
    margin-top: 16px;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
`;

const PrimaryLink = styled(Link)`
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 10px;
    background: linear-gradient(135deg, #075985 0%, #0284c7 100%);
    color: #ffffff;
    font-size: 0.85rem;
    font-weight: 600;
`;

const SecondaryLink = styled(Link)`
    display: inline-flex;
    align-items: center;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #334155;
    font-size: 0.85rem;
    font-weight: 600;
`;

const SectionHeader = styled.div`
    margin-top: 4px;

    h2 {
        color: #0f172a;
        font-size: 1.16rem;
    }

    p {
        margin-top: 6px;
        color: #64748b;
        font-size: 0.9rem;
    }
`;

const StepsGrid = styled.section`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;

    @media (max-width: 900px) {
        grid-template-columns: 1fr;
    }
`;

const StepCard = styled.article`
    background: #ffffff;
    border: 1px solid ${({ $active }) => ($active ? "#7dd3fc" : "#e5e7eb")};
    border-radius: 16px;
    overflow: hidden;
    box-shadow: ${({ $active }) =>
        $active ? "0 10px 22px rgba(14, 116, 144, 0.16)" : "0 4px 10px rgba(15, 23, 42, 0.04)"};
    transition: all 0.22s ease;
`;

const StepImageWrap = styled.div`
    position: relative;
`;

const StepImage = styled.img`
    width: 100%;
    height: 190px;
    object-fit: cover;
`;

const StepNumber = styled.span`
    position: absolute;
    top: 12px;
    left: 12px;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: #0284c7;
    color: white;
    font-size: 0.82rem;
    font-weight: 700;
`;

const StepBody = styled.div`
    padding: 14px;
`;

const StepTitle = styled.h3`
    color: #0f172a;
    font-size: 1rem;
`;

const StepText = styled.p`
    margin-top: 6px;
    color: #64748b;
    font-size: 0.9rem;
    line-height: 1.58;
`;

const FeatureGrid = styled.section`
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;

    @media (max-width: 900px) {
        grid-template-columns: 1fr;
    }
`;

const FeatureCard = styled.article`
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 16px;

    h3 {
        margin-top: 10px;
        color: #0f172a;
        font-size: 0.98rem;
    }

    p {
        margin-top: 8px;
        color: #64748b;
        font-size: 0.88rem;
        line-height: 1.62;
    }
`;

const FeatureIcon = styled.div`
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: #e0f2fe;
    color: #0369a1;
`;

const ShowcasePanel = styled.section`
    background: #0f172a;
    border-radius: 18px;
    padding: 20px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    color: #e2e8f0;

    @media (max-width: 900px) {
        grid-template-columns: 1fr;
    }
`;

const ShowcaseMedia = styled.div`
    img {
        width: 100%;
        height: 100%;
        max-height: 300px;
        object-fit: cover;
        border-radius: 12px;
        border: 1px solid rgba(148, 163, 184, 0.3);
    }
`;

const ShowcaseContent = styled.div`
    display: flex;
    flex-direction: column;

    h3 {
        color: #f8fafc;
        font-size: 1.14rem;
    }
`;

const Checklist = styled.ul`
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;

    li {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        color: #cbd5e1;
        font-size: 0.9rem;
        line-height: 1.55;
    }

    svg {
        color: #38bdf8;
        margin-top: 2px;
        flex-shrink: 0;
    }
`;
