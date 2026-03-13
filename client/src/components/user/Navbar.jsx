import React, { useState } from 'react';
import logo from '../../assets/logo.svg';
import { FaRegUserCircle } from "react-icons/fa";
import { HiMenuAlt3, HiX } from "react-icons/hi";
import styled from 'styled-components';
import axios from 'axios'; 
import ApiConfig from '../config/LocalConfigApi';

function Navbar({ user }) {
    const [showDropdown, setShowDropdown] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => { 
        await axios.post(`${ApiConfig.apiURL}logout`, {}, { withCredentials: true });
        window.location.href = '/';
    };

    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };

    return (
        <NavbarWrapper>
            {/* Logo Section */}
            <LogoSection>
                <LogoImage src={logo} alt="Logo" />
                <BrandName>VideoAnalyzer</BrandName>
            </LogoSection>

            {/* Desktop User Section */}
            <DesktopUserSection>
                {/* User Email Badge */}
                {user && (
                    <EmailBadge>
                        <EmailText>{user.acc_email}</EmailText>
                    </EmailBadge>
                )}

                {/* User Avatar with Dropdown */}
                <UserAvatarWrapper>
                    <UserAvatar
                        onMouseEnter={() => setShowDropdown(true)}
                        onMouseLeave={() => setShowDropdown(false)}
                        onClick={toggleDropdown}
                        aria-label="User menu"
                        aria-expanded={showDropdown}
                    >
                        <AvatarCircle>
                            {user?.acc_email?.substring(0, 2).toUpperCase() || "U"}
                        </AvatarCircle>
                    </UserAvatar>

                    {/* Dropdown Menu */}
                    {showDropdown && (
                        <DropdownMenu
                            onMouseEnter={() => setShowDropdown(true)}
                            onMouseLeave={() => setShowDropdown(false)}
                        >
                            {user && (
                                <DropdownHeader>
                                    <DropdownLabel>Signed in as</DropdownLabel>
                                    <DropdownEmail>{user.acc_email}</DropdownEmail>
                                </DropdownHeader>
                            )}
                            <DropdownButton onClick={handleLogout}>
                                Log Out
                            </DropdownButton>
                        </DropdownMenu>
                    )}
                </UserAvatarWrapper>
            </DesktopUserSection>

            {/* Mobile Section */}
            <MobileSection>
                {user && (
                    <MobileEmail>{user.acc_email}</MobileEmail>
                )}
                <MobileMenuButton
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-label="Toggle menu"
                    aria-expanded={isMobileMenuOpen}
                >
                    {isMobileMenuOpen ? (
                        <HiX className="text-2xl" />
                    ) : (
                        <HiMenuAlt3 className="text-2xl" />
                    )}
                </MobileMenuButton>
            </MobileSection>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <>
                    <Backdrop onClick={() => setIsMobileMenuOpen(false)} />
                    <MobileMenuPanel>
                        <MobileMenuContent>
                            {user && (
                                <MobileUserInfo>
                                    <DropdownLabel>Signed in as</DropdownLabel>
                                    <DropdownEmail>{user.acc_email}</DropdownEmail>
                                </MobileUserInfo>
                            )}
                            <MobileMenuItems>
                                <MobileMenuItem
                                    onClick={() => {
                                        handleLogout();
                                        setIsMobileMenuOpen(false);
                                    }}
                                >
                                    <FaRegUserCircle className="text-lg" />
                                    Log Out
                                </MobileMenuItem>
                            </MobileMenuItems>
                        </MobileMenuContent>
                    </MobileMenuPanel>
                </>
            )}
        </NavbarWrapper>
    );
}

const NavbarWrapper = styled.nav`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 64px;
    background: white;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    z-index: 50;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

    @media (min-width: 768px) {
        height: 80px;
        padding: 0 40px;
    }
`;

const LogoSection = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
`;

const LogoImage = styled.img`
    height: 32px;
    width: auto;

    @media (min-width: 768px) {
        height: 40px;
    }
`;

const BrandName = styled.span`
    display: none;
    font-size: 16px;
    font-weight: 600;
    color: #0284c7;

    @media (min-width: 640px) {
        display: block;
    }
`;

const DesktopUserSection = styled.div`
    display: none;
    align-items: center;
    gap: 24px;

    @media (min-width: 768px) {
        display: flex;
    }
`;

const EmailBadge = styled.div`
    display: flex;
    align-items: center;
    padding: 10px 16px;
    background-color: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
`;

const EmailText = styled.span`
    font-size: 0.875rem;
    color: #4b5563;
    font-weight: 500;
`;

const UserAvatarWrapper = styled.div`
    position: relative;
`;

const UserAvatar = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
        background-color: #f3f4f6;
    }
`;

const AvatarCircle = styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, #075985 0%, #0284c7 100%);
    border-radius: 50%;
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
`;

const DropdownMenu = styled.div`
    position: absolute;
    right: 0;
    top: calc(100% + -5px);
    width: 240px;
    background: white;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.05);
    border-radius: 12px;
    border: 1px solid #e5e7eb;
    padding: 8px 0;
    z-index: 60;
`;

const DropdownHeader = styled.div`
    padding: 12px 16px;
    border-bottom: 1px solid #f3f4f6;
`;

const DropdownLabel = styled.p`
    font-size: 0.75rem;
    color: #9ca3af;
    margin-bottom: 4px;
`;

const DropdownEmail = styled.p`
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const DropdownButton = styled.button`
    width: 100%;
    text-align: left;
    padding: 12px 16px;
    font-size: 0.875rem;
    color: #4b5563;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background-color 0.15s;

    &:hover {
        background-color: #f9fafb;
    }
`;

const MobileSection = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;

    @media (min-width: 768px) {
        display: none;
    }
`;

const MobileEmail = styled.span`
    font-size: 0.75rem;
    color: #6b7280;
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const MobileMenuButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: #374151;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
        background-color: #f3f4f6;
    }
`;

const Backdrop = styled.div`
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 40;

    @media (min-width: 768px) {
        display: none;
    }
`;

const MobileMenuPanel = styled.div`
    position: fixed;
    top: 64px;
    right: 0;
    width: 280px;
    max-width: 90vw;
    background: white;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
    border-radius: 0 0 0 16px;
    z-index: 50;

    @media (min-width: 768px) {
        display: none;
    }
`;

const MobileMenuContent = styled.div`
    padding: 16px 0;
`;

const MobileUserInfo = styled.div`
    padding: 16px 24px;
    border-bottom: 1px solid #f3f4f6;
`;

const MobileMenuItems = styled.div`
    padding: 8px 16px;
`;

const MobileMenuItem = styled.button`
    width: 100%;
    text-align: left;
    padding: 12px 16px;
    font-size: 0.875rem;
    color: #374151;
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: background-color 0.15s;

    &:hover {
        background-color: #f9fafb;
    }
`;

export default Navbar;