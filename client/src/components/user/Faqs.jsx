import React, { useMemo, useState } from "react";
import styled from "styled-components";
import { HiMenuAlt3 } from "react-icons/hi";
import { FiChevronDown, FiSearch, FiLifeBuoy, FiBookOpen } from "react-icons/fi";
import Navbar from "./Navbar";
import Leftbar from "./Leftbar";
import { useAuth } from "./Login";

const FAQ_ITEMS = [
    {
        id: 1,
        category: "Platform",
        question: "What is KATHA?",
        answer:
            "KATHA is a workspace for evaluating uploaded video presentations. It summarizes your message, estimates audience reaction, and gives practical recommendations so you can refine delivery and content before publishing.",
    },
    {
        id: 2,
        category: "Analysis",
        question: "How does the summary feature work?",
        answer:
            "After upload, the system transcribes your video, extracts key points, and structures them into a short executive-style summary. This helps you review the core narrative quickly without replaying the full video.",
    },
    {
        id: 3,
        category: "Analysis",
        question: "Can the tool estimate audience engagement?",
        answer:
            "Yes. The platform combines pacing, visual cues, and audio sentiment indicators to estimate likely audience reception and highlight sections that may need stronger clarity or energy.",
    },
    {
        id: 4,
        category: "Analysis",
        question: "Which metrics are included in effective analysis?",
        answer:
            "You get structured signals such as speech clarity, delivery pace, emotional tone, and suggested improvements for message structure, call-to-action quality, and viewer impact.",
    },
    {
        id: 5,
        category: "Analysis",
        question: "How accurate are prediction insights?",
        answer:
            "Prediction insights are directional and are designed to support decision-making. They are based on pattern recognition from analyzed samples and should be used together with your content goals and human review.",
    },
    {
        id: 6,
        category: "Uploads",
        question: "What video formats are supported?",
        answer:
            "The uploader supports common formats including MP4, MOV, AVI, WMV, and WebM. For best results, use clear voice audio and avoid heavy background noise.",
    },
    {
        id: 7,
        category: "Uploads",
        question: "Is there a maximum video length?",
        answer:
            "Usage limits depend on your account tier and configured storage allocation. If a file exceeds your current plan limit, you can trim the video or move to a higher plan.",
    },
    {
        id: 8,
        category: "Performance",
        question: "How long does analysis usually take?",
        answer:
            "Typical processing time is a few minutes for short videos and can be longer for high-resolution or feature-heavy content. The app keeps you informed with progress updates during processing.",
    },
    {
        id: 9,
        category: "Reports",
        question: "Can I download or save reports?",
        answer:
            "Yes. You can save analyzed videos to your account and review report data later. Export options depend on the enabled features in your environment.",
    },
    {
        id: 10,
        category: "Workflow",
        question: "How should I use the recommendations effectively?",
        answer:
            "Start with the top three issues with highest impact, revise one section at a time, then re-upload for comparison. Iterative refinement produces better results than trying to change everything in one pass.",
    },
];

function Faqs() {
    const { user } = useAuth();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [activeFaq, setActiveFaq] = useState(1);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");

    const categories = useMemo(() => {
        const unique = Array.from(new Set(FAQ_ITEMS.map((item) => item.category)));
        return ["All", ...unique];
    }, []);

    const filteredFaqs = useMemo(() => {
        const query = search.trim().toLowerCase();
        return FAQ_ITEMS.filter((item) => {
            const matchesCategory = activeCategory === "All" || item.category === activeCategory;
            const matchesSearch =
                !query ||
                item.question.toLowerCase().includes(query) ||
                item.answer.toLowerCase().includes(query);
            return matchesCategory && matchesSearch;
        });
    }, [search, activeCategory]);

    return (
        <PageShell>
            <Navbar user={user} activePath="/faqs" />
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
                        <HeroBadge>Support Center</HeroBadge>
                        <HeroTitle>Frequently Asked Questions</HeroTitle>
                        <HeroText>
                            Find clear answers about uploads, analysis quality, reporting, and day-to-day workflow.
                        </HeroText>

                        <SearchBox>
                            <FiSearch size={18} />
                            <SearchInput
                                type="text"
                                value={search}
                                placeholder="Search FAQs"
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </SearchBox>

                        <CategoryRow>
                            {categories.map((category) => (
                                <CategoryChip
                                    key={category}
                                    type="button"
                                    $active={activeCategory === category}
                                    onClick={() => setActiveCategory(category)}
                                >
                                    {category}
                                </CategoryChip>
                            ))}
                        </CategoryRow>
                    </HeroCard>

                    <FaqCard>
                        {filteredFaqs.length === 0 ? (
                            <EmptyState>
                                <h3>No matching FAQs</h3>
                                <p>Try a different keyword or switch category.</p>
                            </EmptyState>
                        ) : (
                            filteredFaqs.map((faq) => {
                                const isOpen = activeFaq === faq.id;
                                return (
                                    <FaqItem key={faq.id}>
                                        <FaqButton
                                            type="button"
                                            onClick={() => setActiveFaq(isOpen ? null : faq.id)}
                                            $open={isOpen}
                                            aria-expanded={isOpen}
                                        >
                                            <QuestionGroup>
                                                <CategoryTag>{faq.category}</CategoryTag>
                                                <QuestionText>{faq.question}</QuestionText>
                                            </QuestionGroup>
                                            <ChevronWrap $open={isOpen}>
                                                <FiChevronDown size={20} />
                                            </ChevronWrap>
                                        </FaqButton>
                                        <FaqAnswer $open={isOpen}>
                                            <p>{faq.answer}</p>
                                        </FaqAnswer>
                                    </FaqItem>
                                );
                            })
                        )}
                    </FaqCard>

                    <HelpGrid>
                        <HelpPanel>
                            <HelpIcon>
                                <FiLifeBuoy size={18} />
                            </HelpIcon>
                            <h3>Need direct assistance?</h3>
                            <p>
                                Reach support for account, upload, or technical concerns that require manual help.
                            </p>
                            <HelpButton href="mailto:support@katha.local">Contact Support</HelpButton>
                        </HelpPanel>

                        <HelpPanel>
                            <HelpIcon>
                                <FiBookOpen size={18} />
                            </HelpIcon>
                            <h3>Product documentation</h3>
                            <p>
                                Review setup notes, feature behavior, and recommended workflows for best results.
                            </p>
                            <HelpGhostButton href="/how-it-works">Open Guides</HelpGhostButton>
                        </HelpPanel>
                    </HelpGrid>
                </ContentWrapper>
            </MainArea>
        </PageShell>
    );
}

export default Faqs;

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
    max-width: 1040px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
`;

const HeroCard = styled.section`
    background: linear-gradient(145deg, #ffffff 0%, #f0f9ff 100%);
    border: 1px solid #dbeafe;
    border-radius: 18px;
    padding: 24px;
    box-shadow: 0 14px 30px rgba(2, 132, 199, 0.08);
`;

const HeroBadge = styled.span`
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: #e0f2fe;
    color: #0369a1;
    font-size: 0.74rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
`;

const HeroTitle = styled.h1`
    margin-top: 12px;
    font-size: clamp(1.4rem, 2.2vw, 1.9rem);
    color: #0f172a;
    line-height: 1.2;
`;

const HeroText = styled.p`
    margin-top: 8px;
    font-size: 0.95rem;
    color: #475569;
    max-width: 65ch;
`;

const SearchBox = styled.div`
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: white;
    border: 1px solid #bfdbfe;
    border-radius: 12px;
    padding: 10px 12px;
    color: #64748b;

    &:focus-within {
        border-color: #0284c7;
        box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.12);
    }
`;

const SearchInput = styled.input`
    width: 100%;
    border: 0;
    outline: none;
    background: transparent;
    color: #0f172a;
    font-size: 0.9rem;

    &::placeholder {
        color: #94a3b8;
    }
`;

const CategoryRow = styled.div`
    margin-top: 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
`;

const CategoryChip = styled.button`
    border: 1px solid ${({ $active }) => ($active ? "#0284c7" : "#cbd5e1")};
    background: ${({ $active }) => ($active ? "#0284c7" : "white")};
    color: ${({ $active }) => ($active ? "white" : "#334155")};
    border-radius: 999px;
    padding: 7px 12px;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
`;

const FaqCard = styled.section`
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 18px;
    overflow: hidden;
`;

const FaqItem = styled.div`
    border-bottom: 1px solid #eef2f7;

    &:last-child {
        border-bottom: 0;
    }
`;

const FaqButton = styled.button`
    width: 100%;
    border: 0;
    background: ${({ $open }) => ($open ? "#f8fafc" : "white")};
    padding: 16px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    cursor: pointer;
    text-align: left;
`;

const QuestionGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const CategoryTag = styled.span`
    font-size: 0.7rem;
    color: #0369a1;
    background: #e0f2fe;
    border: 1px solid #bae6fd;
    padding: 3px 8px;
    border-radius: 999px;
    width: fit-content;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
`;

const QuestionText = styled.span`
    font-size: 0.98rem;
    color: #0f172a;
    font-weight: 600;
`;

const ChevronWrap = styled.span`
    color: #475569;
    transform: ${({ $open }) => ($open ? "rotate(180deg)" : "rotate(0deg)")};
    transition: transform 0.2s ease;
`;

const FaqAnswer = styled.div`
    max-height: ${({ $open }) => ($open ? "220px" : "0px")};
    overflow: hidden;
    transition: max-height 0.25s ease;

    p {
        padding: 0 18px 16px;
        color: #475569;
        font-size: 0.92rem;
        line-height: 1.65;
    }
`;

const EmptyState = styled.div`
    padding: 28px;
    text-align: center;

    h3 {
        color: #0f172a;
        font-size: 1rem;
    }

    p {
        color: #64748b;
        margin-top: 6px;
        font-size: 0.88rem;
    }
`;

const HelpGrid = styled.section`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;

    @media (max-width: 760px) {
        grid-template-columns: 1fr;
    }
`;

const HelpPanel = styled.div`
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 18px;

    h3 {
        margin-top: 10px;
        color: #0f172a;
        font-size: 1rem;
    }

    p {
        margin-top: 8px;
        color: #64748b;
        font-size: 0.9rem;
        line-height: 1.6;
    }
`;

const HelpIcon = styled.div`
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: #e0f2fe;
    color: #0369a1;
`;

const HelpButton = styled.a`
    margin-top: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    border-radius: 10px;
    background: linear-gradient(135deg, #075985 0%, #0284c7 100%);
    color: #ffffff;
    font-weight: 600;
    font-size: 0.84rem;
`;

const HelpGhostButton = styled.a`
    margin-top: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #334155;
    font-weight: 600;
    font-size: 0.84rem;
`;
