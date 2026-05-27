import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Swal from 'sweetalert2';
import Logo from '../../assets/logo.svg';
import HomeNavbar from './HomeNavbar';
import img1 from '../../assets/img-1.png';
import img2 from '../../assets/img-2.webp';
import bg1 from '../../assets/bg-1.avif';
import bg2 from '../../assets/bg-2.avif';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './Login';


function Dashboard() {

    const navigate = useNavigate();
    const { user, loading } = useAuth();

    useEffect(() => {
        if (!loading && user) { 
            navigate('/', { replace: true });
        }
    }, [user, loading, navigate]);

    if (loading || user) return null;


    return (
        <div>
            <PageWrapper>
                <title>Dashboard</title>
                <HomeNavbar />

                <ContentContainer>
                    {/* Hero Section */}
                    <HeroSection>
                        <HeroContent>
                            <HeroTitle>Analyze Your Videos</HeroTitle>
                            <HeroCaption>
                                Welcome to your dashboard! Here you can upload your videos and let our AI analyze them for you.
                                Simply click the button below to get started.
                            </HeroCaption>
                            <CTAButton to="/">
                                Start Analyzing
                            </CTAButton>
                        </HeroContent>

                        <HeroImageWrapper>
                            <HeroImage src={img1} alt="Dashboard image" />
                        </HeroImageWrapper>
                    </HeroSection>

                    {/* Features Section */}
                    <SectionTitle>Unlock Insights from Your Videos</SectionTitle>
                    <SectionDescription>
                        With our powerful video analysis tools, you can gain insights into your videos like never before.
                        Whether you're a content creator, marketer, or just curious, our dashboard provides you with the tools you need to understand your videos better.
                    </SectionDescription>

                    {/* Card Grid */}
                    <CardGrid>
                        <FeatureCard>
                            <CardImageWrapper>
                                <CardImage src={bg1} alt="Video Analysis" />
                            </CardImageWrapper>
                            <CardContent>
                                <CardTitle>Smart Video Analysis</CardTitle>
                                <CardCaption>
                                    Leverage AI-powered insights to understand viewer engagement, content patterns, and optimization opportunities in real-time.
                                </CardCaption>
                            </CardContent>
                        </FeatureCard>

                        <FeatureCard>
                            <CardImageWrapper>
                                <CardImage src={bg2} alt="Real-time Insights" />
                            </CardImageWrapper>
                            <CardContent>
                                <CardTitle>Real-time Insights</CardTitle>
                                <CardCaption>
                                    Get instant feedback on your content performance with comprehensive analytics and actionable recommendations.
                                </CardCaption>
                            </CardContent>
                        </FeatureCard>

                        <FeatureCard>
                            <CardImageWrapper>
                                <CardImage src={img2} alt="Easy Integration" />
                            </CardImageWrapper>
                            <CardContent>
                                <CardTitle>Easy Integration</CardTitle>
                                <CardCaption>
                                    Seamlessly connect your existing workflows with our intuitive platform designed for creators and marketers.
                                </CardCaption>
                            </CardContent>
                        </FeatureCard>
                    </CardGrid>

                    {/* Gallery Section */}
                    <GallerySection>
                        <SectionTitle>Our Work in Action</SectionTitle>
                        <SectionDescription>
                            Explore examples of video analysis and insights delivered through our platform.
                        </SectionDescription>

                        <GalleryGrid>
                            <GalleryItem className="large">
                                <GalleryImageWrapper>
                                    <GalleryImage src={img1} alt="Video analysis example 1" />
                                </GalleryImageWrapper>
                                <GalleryOverlay>
                                    <GalleryTitle>Content Performance Analysis</GalleryTitle>
                                    <GalleryDescription>Real-time engagement tracking</GalleryDescription>
                                </GalleryOverlay>
                            </GalleryItem>

                            <GalleryItem>
                                <GalleryImageWrapper>
                                    <GalleryImage src={img2} alt="Video analysis example 2" />
                                </GalleryImageWrapper>
                                <GalleryOverlay>
                                    <GalleryTitle>Audience Insights</GalleryTitle>
                                    <GalleryDescription>Viewer demographics</GalleryDescription>
                                </GalleryOverlay>
                            </GalleryItem>

                            <GalleryItem>
                                <GalleryImageWrapper>
                                    <GalleryImage src={img1} alt="Video analysis example 3" />
                                </GalleryImageWrapper>
                                <GalleryOverlay>
                                    <GalleryTitle>Engagement Metrics</GalleryTitle>
                                    <GalleryDescription>Watch time analytics</GalleryDescription>
                                </GalleryOverlay>
                            </GalleryItem>

                            <GalleryItem className="wide">
                                <GalleryImageWrapper>
                                    <GalleryImage src={img2} alt="Video analysis example 4" />
                                </GalleryImageWrapper>
                                <GalleryOverlay>
                                    <GalleryTitle>Sentiment Analysis</GalleryTitle>
                                    <GalleryDescription>Viewer reactions and feedback</GalleryDescription>
                                </GalleryOverlay>
                            </GalleryItem>
                        </GalleryGrid>
                    </GallerySection>

                    {/* How It Works Section */}
                    <HowItWorksSection>
                        <SectionTitle>How It Works</SectionTitle>
                        <SectionDescription>
                            Get started with video analysis in three simple steps. Our streamlined process ensures you get insights quickly and efficiently.
                        </SectionDescription>

                        <StepsGrid>
                            <StepCard>
                                <StepNumber>01</StepNumber>
                                <StepTitle>Upload Your Video</StepTitle>
                                <StepDescription>
                                    Simply drag and drop your video file or paste a URL. We support all major video formats and platforms.
                                </StepDescription>
                            </StepCard>

                            <StepCard>
                                <StepNumber>02</StepNumber>
                                <StepTitle>AI Analysis</StepTitle>
                                <StepDescription>
                                    Our advanced AI processes your video, analyzing content, engagement patterns, and performance metrics.
                                </StepDescription>
                            </StepCard>

                            <StepCard>
                                <StepNumber>03</StepNumber>
                                <StepTitle>Get Insights</StepTitle>
                                <StepDescription>
                                    Review comprehensive reports with actionable insights to optimize your content and grow your audience.
                                </StepDescription>
                            </StepCard>
                        </StepsGrid>
                    </HowItWorksSection>

                    {/* Featured Content Section */}
                    <FeaturedSection>
                        <FeaturedImageLarge>
                            <img src={img1} alt="Featured content" />
                        </FeaturedImageLarge>
                        <FeaturedContent>
                            <FeaturedLabel>Featured Analysis</FeaturedLabel>
                            <FeaturedTitle>Transform Your Video Content Strategy</FeaturedTitle>
                            <FeaturedDescription>
                                Discover patterns and insights you never knew existed. Our AI-powered platform helps you understand what resonates with your audience, optimize content for better engagement, and make data-driven decisions that drive results.
                            </FeaturedDescription>
                            <FeatureList>
                                <FeatureItem>
                                    <FeatureIcon>✓</FeatureIcon>
                                    <FeatureText>Advanced sentiment analysis</FeatureText>
                                </FeatureItem>
                                <FeatureItem>
                                    <FeatureIcon>✓</FeatureIcon>
                                    <FeatureText>Real-time engagement tracking</FeatureText>
                                </FeatureItem>
                                <FeatureItem>
                                    <FeatureIcon>✓</FeatureIcon>
                                    <FeatureText>Competitor benchmarking</FeatureText>
                                </FeatureItem>
                                <FeatureItem>
                                    <FeatureIcon>✓</FeatureIcon>
                                    <FeatureText>Automated reporting</FeatureText>
                                </FeatureItem>
                            </FeatureList>
                            <CTAButton to="/">Learn More</CTAButton>
                        </FeaturedContent>
                    </FeaturedSection>
                </ContentContainer>
            </PageWrapper>
            <footer className='bg-white text-gray-500'>
                <div className='text-sm' style={{ textAlign: 'center', padding: '6px' }}>
                    &copy; {new Date().getFullYear()} KATHA. All rights reserved.
                </div>
            </footer>
        </div>
    )
}

const PageWrapper = styled.div`
    min-height: 100vh;
    background-color: #f5f5f7;
`;

const ContentContainer = styled.div`
    max-width: 1200px;
    margin: 0 auto;
    padding: 60px 24px;

    @media (max-width: 768px) {
        padding: 40px 20px;
    }
`;

const HeroSection = styled.section`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    align-items: center;
    margin-bottom: 100px;
    padding: 40px 0;

    @media (max-width: 968px) {
        grid-template-columns: 1fr;
        gap: 32px;
        margin-bottom: 80px;
    }
`;

const HeroContent = styled.div`
    display: flex;
    flex-direction: column;
    gap: 24px;

    @media (max-width: 968px) {
        text-align: center;
        align-items: center;
    }
`;

const HeroTitle = styled.h1`
    font-size: 3.5rem;
    font-weight: 600;
    color: #075985;
    line-height: 1.1;
    margin: 0;

    @media (max-width: 768px) {
        font-size: 2.5rem;
    }
`;

const HeroCaption = styled.p`
    font-size: 1.125rem;
    font-weight: 300;
    color: #374151;
    line-height: 1.7;
    margin: 0;
    max-width: 520px;

    @media (max-width: 968px) {
        max-width: 100%;
    }
`;

const CTAButton = styled(Link)`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 14px 32px;
    background-color: #0284c7;
    color: white;
    border-radius: 9999px;
    font-size: 1rem;
    font-weight: 500;
    text-decoration: none;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.2);
    align-self: flex-start;

    &:hover {
        background-color: #0369a1;
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(2, 132, 199, 0.3);
    }

    @media (max-width: 968px) {
        align-self: center;
    }
`;

const HeroImageWrapper = styled.div`
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08), 
                0 4px 12px rgba(0, 0, 0, 0.05);
    transition: transform 0.3s ease, box-shadow 0.3s ease;

    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 16px 50px rgba(0, 0, 0, 0.12), 
                    0 6px 20px rgba(0, 0, 0, 0.08);
    }
`;

const HeroImage = styled.img`
    width: 100%;
    height: auto;
    display: block;
`;

const SectionTitle = styled.h2`
    font-size: 2.5rem;
    font-weight: 600;
    color: #075985;
    text-align: center;
    margin: 0 0 24px 0;
    line-height: 1.2;

    @media (max-width: 768px) {
        font-size: 2rem;
    }
`;

const SectionDescription = styled.p`
    font-size: 1.125rem;
    font-weight: 300;
    color: #374151;
    text-align: center;
    line-height: 1.7;
    max-width: 800px;
    margin: 0 auto 60px auto;
`;

const CardGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 32px;
    margin-top: 48px;

    @media (max-width: 768px) {
        grid-template-columns: 1fr;
        gap: 24px;
    }
`;

const FeatureCard = styled.div`
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04),
                0 1px 4px rgba(0, 0, 0, 0.04);
    transition: all 0.3s ease;
    border: 1px solid rgba(7, 89, 133, 0.08);

    &:hover {
        transform: translateY(-6px);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1),
                    0 4px 12px rgba(0, 0, 0, 0.06);
        border-color: rgba(7, 89, 133, 0.15);
    }
`;

const CardImageWrapper = styled.div`
    width: 100%;
    height: 220px;
    overflow: hidden;
    background-color: #f5f5f7;
`;

const CardImage = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s ease;

    ${FeatureCard}:hover & {
        transform: scale(1.05);
    }
`;

const CardContent = styled.div`
    padding: 28px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const CardTitle = styled.h3`
    font-size: 1.375rem;
    font-weight: 600;
    color: #075985;
    margin: 0;
    line-height: 1.3;
`;

const CardCaption = styled.p`
    font-size: 0.9375rem;
    font-weight: 300;
    color: #4b5563;
    line-height: 1.6;
    margin: 0;
`;

const GallerySection = styled.section`
    margin: 80px 0;
`;

const GalleryGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-rows: 280px;
    gap: 20px;
    margin-top: 48px;

    .large {
        grid-column: span 2;
        grid-row: span 2;
    }

    .wide {
        grid-column: span 2;
    }

    @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr);
        grid-auto-rows: 240px;

        .large {
            grid-column: span 2;
            grid-row: span 1;
        }
    }

    @media (max-width: 640px) {
        grid-template-columns: 1fr;
        gap: 16px;

        .large,
        .wide {
            grid-column: span 1;
            grid-row: span 1;
        }
    }
`;

const GalleryItem = styled.div`
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    border: 1px solid rgba(7, 89, 133, 0.08);
    transition: all 0.3s ease;

    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
        border-color: rgba(2, 132, 199, 0.2);
    }

    &:hover div:last-child {
        opacity: 1;
    }

    &:hover img {
        transform: scale(1.05);
    }
`;

const GalleryImageWrapper = styled.div`
    width: 100%;
    height: 100%;
    background-color: #f5f5f7;
`;

const GalleryImage = styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s ease;
`;

const GalleryOverlay = styled.div`
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(to top, rgba(7, 89, 133, 0.95) 0%, rgba(7, 89, 133, 0.7) 70%, transparent 100%);
    padding: 24px 20px;
    opacity: 0;
    transition: opacity 0.3s ease;
    display: flex;
    flex-direction: column;
    gap: 4px;

    @media (max-width: 640px) {
        opacity: 1;
        background: linear-gradient(to top, rgba(7, 89, 133, 0.9) 0%, rgba(7, 89, 133, 0.6) 60%, transparent 100%);
    }
`;

const GalleryTitle = styled.h3`
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin: 0;
    line-height: 1.3;
`;

const GalleryDescription = styled.p`
    font-size: 0.875rem;
    font-weight: 300;
    color: rgba(255, 255, 255, 0.9);
    margin: 0;
`;

const HowItWorksSection = styled.section`
    margin: 100px 0;

    @media (max-width: 768px) {
        margin: 80px 0;
    }
`;

const StepsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 32px;
    margin-top: 48px;

    @media (max-width: 768px) {
        grid-template-columns: 1fr;
        gap: 24px;
    }
`;

const StepCard = styled.div`
    background: white;
    padding: 36px 28px;
    border-radius: 16px;
    border: 1px solid rgba(7, 89, 133, 0.08);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    transition: all 0.3s ease;
    position: relative;

    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        border-color: rgba(2, 132, 199, 0.2);
    }
`;

const StepNumber = styled.div`
    font-size: 3rem;
    font-weight: 700;
    color: rgba(2, 132, 199, 0.15);
    margin-bottom: 16px;
    line-height: 1;
`;

const StepTitle = styled.h3`
    font-size: 1.375rem;
    font-weight: 600;
    color: #075985;
    margin: 0 0 12px 0;
`;

const StepDescription = styled.p`
    font-size: 0.9375rem;
    font-weight: 300;
    color: #4b5563;
    line-height: 1.6;
    margin: 0;
`;

const FeaturedSection = styled.section`
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 48px;
    align-items: center;
    margin: 100px 0;
    padding: 60px 48px;
    background: white;
    border-radius: 20px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    border: 1px solid rgba(7, 89, 133, 0.08);

    @media (max-width: 968px) {
        grid-template-columns: 1fr;
        gap: 32px;
        padding: 40px 28px;
        margin: 80px 0;
    }
`;

const FeaturedImageLarge = styled.div`
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);

    img {
        width: 100%;
        height: auto;
        display: block;
    }
`;

const FeaturedContent = styled.div`
    display: flex;
    flex-direction: column;
    gap: 20px;
`;

const FeaturedLabel = styled.div`
    font-size: 0.75rem;
    font-weight: 600;
    color: #0284c7;
    text-transform: uppercase;
    letter-spacing: 0.1em;
`;

const FeaturedTitle = styled.h2`
    font-size: 2rem;
    font-weight: 600;
    color: #075985;
    line-height: 1.2;
    margin: 0;

    @media (max-width: 768px) {
        font-size: 1.75rem;
    }
`;

const FeaturedDescription = styled.p`
    font-size: 1rem;
    font-weight: 300;
    color: #374151;
    line-height: 1.7;
    margin: 0;
`;

const FeatureList = styled.ul`
    list-style: none;
    padding: 0;
    margin: 8px 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const FeatureItem = styled.li`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const FeatureIcon = styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: rgba(2, 132, 199, 0.1);
    color: #0284c7;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
`;

const FeatureText = styled.span`
    font-size: 0.9375rem;
    font-weight: 400;
    color: #374151;
`;

const AdditionalFeaturesSection = styled.section`
    margin: 100px 0;

    @media (max-width: 768px) {
        margin: 80px 0;
    }
`;

const SmallCardGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 24px;
    margin-top: 48px;

    @media (max-width: 768px) {
        grid-template-columns: 1fr;
        gap: 20px;
    }
`;

const SmallFeatureCard = styled.div`
    background: white;
    padding: 32px 24px;
    border-radius: 12px;
    border: 1px solid rgba(7, 89, 133, 0.08);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 12px;

    &:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        border-color: rgba(2, 132, 199, 0.2);
    }
`;

const IconWrapper = styled.div`
    font-size: 2.5rem;
    margin-bottom: 8px;
`;

const SmallCardTitle = styled.h4`
    font-size: 1.125rem;
    font-weight: 600;
    color: #075985;
    margin: 0;
`;

const SmallCardCaption = styled.p`
    font-size: 0.875rem;
    font-weight: 300;
    color: #6b7280;
    margin: 0;
    line-height: 1.5;
`;

const CTASection = styled.section`
    background: linear-gradient(135deg, #075985 0%, #0284c7 100%);
    padding: 80px 48px;
    border-radius: 20px;
    margin: 100px 0 60px 0;
    box-shadow: 0 12px 40px rgba(2, 132, 199, 0.2);

    @media (max-width: 768px) {
        padding: 60px 32px;
        margin: 80px 0 40px 0;
    }
`;

const CTASectionContent = styled.div`
    max-width: 700px;
    margin: 0 auto;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
`;

const CTASectionTitle = styled.h2`
    font-size: 2.5rem;
    font-weight: 600;
    color: white;
    margin: 0;
    line-height: 1.2;

    @media (max-width: 768px) {
        font-size: 2rem;
    }
`;

const CTASectionDescription = styled.p`
    font-size: 1.125rem;
    font-weight: 300;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.7;
    margin: 0;
`;

const CTAButtonLarge = styled(Link)`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 16px 40px;
    background-color: white;
    color: #0284c7;
    border-radius: 9999px;
    font-size: 1.125rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.3s ease;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        background-color: #f5f5f7;
    }
`;

export default Dashboard;