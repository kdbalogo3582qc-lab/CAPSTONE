import React, { useState } from 'react';
import logo from '../../assets/logo.svg';
import { HiMenuAlt3, HiX } from "react-icons/hi";
import { FiUser, FiLogOut, FiVideo } from "react-icons/fi";
import styled, { keyframes } from 'styled-components';
import axios from 'axios';
import ApiConfig from '../config/LocalConfigApi';

const DROPDOWN_LINKS = [
    { label: 'Profile', icon: <FiUser />, href: '/profile' },
    { label: 'My Recordings', icon: <FiVideo />, href: '/saved-videos' },
];

function Navbar({ user, activePath }) {
    const [showDropdown, setShowDropdown] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await axios.post(`${ApiConfig.apiURL}/logout`, {}, { withCredentials: true });
        } catch {
            // Even if token is already expired, continue with client-side sign out UX.
        }
        window.location.href = '/';
    };

    const initials = user?.acc_email?.substring(0, 2).toUpperCase() || 'U';

    return (
        <>
            <NavbarWrapper>
                {/* Logo */}
                <LogoSection href="/home">
                    <LogoImage src={logo} alt="Logo" />
                    <BrandName>KATHA</BrandName>
                </LogoSection>

                {/* Desktop User Section */}
                <DesktopUserSection>
                    <UserAvatarWrapper
                        onMouseEnter={() => setShowDropdown(true)}
                        onMouseLeave={() => setShowDropdown(false)}
                    >
                        <UserAvatar aria-label="User menu" aria-expanded={showDropdown}>
                            <AvatarCircle>{initials}</AvatarCircle>
                            <UserMeta>
                                <UserName>{user?.acc_email?.split('@')[0] || 'User'}</UserName>
                                <UserRole>Member</UserRole>
                            </UserMeta>
                            <ChevronIcon $open={showDropdown}>▾</ChevronIcon>
                        </UserAvatar>

                        {showDropdown && (
                            <DropdownMenu>
                                <DropdownHeader>
                                    <DropdownInitials>{initials}</DropdownInitials>
                                    <div>
                                        <DropdownName>{user?.acc_email?.split('@')[0] || 'User'}</DropdownName>
                                        <DropdownEmail>{user?.acc_email}</DropdownEmail>
                                    </div>
                                </DropdownHeader>

                                <DropdownSection>
                                    {DROPDOWN_LINKS.map(({ label, icon, href }) => (
                                        <DropdownLink key={label} href={href} $active={activePath === href}>
                                            <DropdownLinkIcon>{icon}</DropdownLinkIcon>
                                            {label}
                                        </DropdownLink>
                                    ))}
                                </DropdownSection>

                                <DropdownDivider />

                                <DropdownButton onClick={handleLogout}>
                                    <FiLogOut />
                                    Sign Out
                                </DropdownButton>
                            </DropdownMenu>
                        )}
                    </UserAvatarWrapper>
                </DesktopUserSection>

                {/* Mobile */}
                <MobileSection>
                    <MobileAvatar>{initials}</MobileAvatar>
                    <MobileMenuButton
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label="Toggle menu"
                        aria-expanded={isMobileMenuOpen}
                    >
                        {isMobileMenuOpen ? <HiX size={22} /> : <HiMenuAlt3 size={22} />}
                    </MobileMenuButton>
                </MobileSection>
            </NavbarWrapper>

            {/* Mobile Drawer */}
            {isMobileMenuOpen && (
                <>
                    <Backdrop onClick={() => setIsMobileMenuOpen(false)} />
                    <MobileDrawer>
                        <DrawerHeader>
                            <DrawerAvatar>{initials}</DrawerAvatar>
                            <div>
                                <DrawerName>{user?.acc_email?.split('@')[0] || 'User'}</DrawerName>
                                <DrawerEmail>{user?.acc_email}</DrawerEmail>
                            </div>
                        </DrawerHeader>

                        <DrawerNav>
                            {DROPDOWN_LINKS.map(({ label, icon, href }) => (
                                <DrawerNavLink
                                    key={label}
                                    href={href}
                                    $active={activePath === href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <DrawerNavIcon $active={activePath === href}>{icon}</DrawerNavIcon>
                                    {label}
                                </DrawerNavLink>
                            ))}
                        </DrawerNav>

                        <DrawerFooter>
                            <DrawerLogout onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}>
                                <FiLogOut />
                                Sign Out
                            </DrawerLogout>
                        </DrawerFooter>
                    </MobileDrawer>
                </>
            )}
        </>
    );
}

// ─── Animations ────────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const slideIn = keyframes`
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
`;

// ─── Navbar Shell ───────────────────────────────────────────────────────────────

const NavbarWrapper = styled.nav`
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 64px;
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    z-index: 100;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    gap: 16px;

    @media (min-width: 768px) {
        height: 68px;
        padding: 0 32px;
    }
`;

// ─── Logo ───────────────────────────────────────────────────────────────────────

const LogoSection = styled.a`
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    flex-shrink: 0;
`;

const LogoImage = styled.img`
    height: 30px;
    width: auto;
`;

const BrandName = styled.span`
    display: none;
    font-size: 15px;
    font-weight: 700;
    color: #0369a1;
    letter-spacing: -0.3px;

    @media (min-width: 640px) {
        display: block;
    }
`;

// ─── Desktop User ───────────────────────────────────────────────────────────────

const DesktopUserSection = styled.div`
    display: none;
    align-items: center;
    flex-shrink: 0;

    @media (min-width: 768px) {
        display: flex;
    }
`;

const UserAvatarWrapper = styled.div`
    position: relative;
`;

const UserAvatar = styled.button`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px 6px 6px;
    border-radius: 40px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
        background: #eff6ff;
        border-color: #bae0fd;
    }
`;

const AvatarCircle = styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%);
    color: white;
    font-size: 0.8rem;
    font-weight: 700;
    flex-shrink: 0;
`;

const UserMeta = styled.div`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.2;
`;

const UserName = styled.span`
    font-size: 0.8rem;
    font-weight: 600;
    color: #111827;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const UserRole = styled.span`
    font-size: 0.7rem;
    color: #9ca3af;
`;

const ChevronIcon = styled.span`
    font-size: 12px;
    color: #6b7280;
    transition: transform 0.2s;
    transform: ${({ $open }) => $open ? 'rotate(180deg)' : 'rotate(0)'};
`;

// ─── Dropdown ───────────────────────────────────────────────────────────────────

const DropdownMenu = styled.div`
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    width: 260px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.04);
    overflow: hidden;
    z-index: 200;
    animation: ${fadeIn} 0.18s ease;
`;

const DropdownHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border-bottom: 1px solid #e0f2fe;
`;

const DropdownInitials = styled.div`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.875rem;
    flex-shrink: 0;
`;

const DropdownName = styled.p`
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 2px;
`;

const DropdownEmail = styled.p`
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 170px;
`;

const DropdownSection = styled.div`
    padding: 8px;
`;

const DropdownLink = styled.a`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: ${({ $active }) => ($active ? '600' : '500')};
    color: ${({ $active }) => ($active ? '#0369a1' : '#374151')};
    background: ${({ $active }) => ($active ? '#eff6ff' : 'transparent')};
    text-decoration: none;
    transition: all 0.12s;

    &:hover {
        background: #f3f8ff;
        color: #0369a1;
    }
`;

const DropdownLinkIcon = styled.span`
    display: flex;
    align-items: center;
    font-size: 15px;
    color: inherit;
`;

const DropdownDivider = styled.hr`
    border: none;
    border-top: 1px solid #f3f4f6;
    margin: 0;
`;

const DropdownButton = styled.button`
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #dc2626;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background-color 0.12s;

    &:hover {
        background: #fef2f2;
    }
`;

// ─── Mobile ─────────────────────────────────────────────────────────────────────

const MobileSection = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;

    @media (min-width: 768px) {
        display: none;
    }
`;

const MobileAvatar = styled.div`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
`;

const MobileMenuButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 8px;
    background: #f3f4f6;
    border: none;
    color: #374151;
    cursor: pointer;
    transition: background-color 0.15s;

    &:hover {
        background: #e5e7eb;
    }
`;

const Backdrop = styled.div`
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.35);
    backdrop-filter: blur(2px);
    z-index: 90;

    @media (min-width: 768px) {
        display: none;
    }
`;

const MobileDrawer = styled.div`
    position: fixed;
    top: 64px;
    right: 0;
    bottom: 0;
    width: 300px;
    max-width: 85vw;
    background: white;
    box-shadow: -4px 0 24px rgba(0,0,0,0.12);
    z-index: 95;
    display: flex;
    flex-direction: column;
    animation: ${slideIn} 0.22s ease;

    @media (min-width: 768px) {
        display: none;
    }
`;

const DrawerHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 20px 16px;
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border-bottom: 1px solid #bae6fd;
`;

const DrawerAvatar = styled.div`
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1rem;
    flex-shrink: 0;
`;

const DrawerName = styled.p`
    font-size: 0.9rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 2px;
`;

const DrawerEmail = styled.p`
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
`;

const DrawerNav = styled.nav`
    flex: 1;
    padding: 12px;
    overflow-y: auto;
`;

const DrawerNavLink = styled.a`
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: ${({ $active }) => ($active ? '600' : '500')};
    color: ${({ $active }) => ($active ? '#0369a1' : '#374151')};
    background: ${({ $active }) => ($active ? '#eff6ff' : 'transparent')};
    text-decoration: none;
    margin-bottom: 2px;
    transition: all 0.12s;

    &:hover {
        background: #f0f9ff;
        color: #0369a1;
    }
`;

const DrawerNavIcon = styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: ${({ $active }) => ($active ? '#dbeafe' : '#f3f4f6')};
    color: ${({ $active }) => ($active ? '#0369a1' : '#6b7280')};
    font-size: 16px;
    flex-shrink: 0;
    transition: all 0.12s;
`;

const DrawerFooter = styled.div`
    padding: 12px 12px 20px;
    border-top: 1px solid #f3f4f6;
`;

const DrawerLogout = styled.button`
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 0.9rem;
    font-weight: 500;
    color: #dc2626;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background-color 0.12s;

    &:hover {
        background: #fef2f2;
    }
`;

export default Navbar;