import React, { useState, useEffect } from 'react';
import { IoHomeOutline } from "react-icons/io5";
import { CiVideoOn } from "react-icons/ci";
import { GoUnlock,  } from "react-icons/go";
import { FaRegCircleQuestion, FaVide } from "react-icons/fa6";
import { FiHardDrive } from "react-icons/fi";
import { Link, useLocation } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import axios from 'axios';
import ApiUrl from '../config/LocalConfigApi';

export default function Leftbar({ isMobileMenuOpen, closeMobileMenu }) {
  const location = useLocation();
  const [active, setActive] = useState("");
  const [storage, setStorage] = useState({ used: 0, max: 5 * 1024 * 1024 * 1024 });

  useEffect(() => {
    axios
      .get(`${ApiUrl.apiURL}/saved-videos/storage`, { withCredentials: true })
      .then((res) => setStorage(res.data))
      .catch(() => {});
  }, []);
  
  // Set active state based on current path
  useEffect(() => {
    const path = location.pathname;
    
    if (path === "/home" || path === "/") {
      setActive("Home");
    } else if (path === "/faqs") {
      setActive("Faqs");
    } else if (path === "/how-it-works") {
      setActive("how-it-works");
    } else if (path === "/saved-videos") {
      setActive("My Recordings");
    } else if (path === "/train-model") {
      setActive("Train Model");
    } else {
      setActive("");
    }
  }, [location.pathname]);
  
  const handleClick = (id) => {
    setActive(id);
    if (closeMobileMenu) closeMobileMenu();
  };

  // Menu item component for consistent styling
  const MenuItem = ({ to, label, icon, id }) => {
    const isActive = active === id;
    return (
      <MenuLink to={to}>
        <MenuItemWrapper
          $isActive={isActive}
          onClick={() => handleClick(id)}
        >
          <IconWrapper $isActive={isActive}>
            {icon}
          </IconWrapper>
          <MenuLabel $isActive={isActive}>{label}</MenuLabel>
        </MenuItemWrapper>
      </MenuLink>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <DesktopSidebar>
        <SidebarContent>
          <MainMenuSection>
            <MenuItem 
              to="/home" 
              label="Home" 
              id="Home"
              icon={<IoHomeOutline size={24} />} 
            />
            
            {/* Commented out but with consistent styling if uncommented */}
            <MenuItem 
              to="/saved-videos" 
              label="My Recordings" 
              id="My Recordings"
              icon={<CiVideoOn size={24} />} 
            />

            <MenuItem 
              to="/train-model" 
              label="Train Model" 
              id="Train Model"
              icon={<GoUnlock size={24} />} 
            />
          </MainMenuSection>

          <OtherMenuSection>
            <SectionLabel>OTHER</SectionLabel>
            
            <MenuItem 
              to="/faqs" 
              label="FAQs" 
              id="Faqs"
              icon={<FaRegCircleQuestion size={24} />} 
            />
            
            <MenuItem 
              to="/how-it-works" 
              label="How It Works" 
              id="how-it-works"
              icon={<FaRegCircleQuestion size={24} />} 
            />

            <StorageSection>
              <StorageHeader>
                <FiHardDrive size={14} />
                <StorageTitle>Storage</StorageTitle>
              </StorageHeader>
              <StorageTrack>
                <StorageFill $pct={Math.min(100, (storage.used / storage.max) * 100)} />
              </StorageTrack>
              <StorageText>
                {formatBytes(storage.used)} of {formatBytes(storage.max)} used
              </StorageText>
            </StorageSection>
          </OtherMenuSection>
        </SidebarContent>
      </DesktopSidebar>

      {/* Mobile Sidebar (slides in from left) */}
      {isMobileMenuOpen && (
        <>
          <MobileBackdrop onClick={closeMobileMenu} />
          <MobileSidebar>
            <SidebarContent>
              <MainMenuSection>
                <MenuItem 
                  to="/home" 
                  label="Home" 
                  id="Home"
                  icon={<IoHomeOutline size={24} />} 
                />
              </MainMenuSection>

              <OtherMenuSection>
                <SectionLabel>OTHER</SectionLabel>
                
                <MenuItem 
                  to="/faqs" 
                  label="FAQs" 
                  id="Faqs"
                  icon={<FaRegCircleQuestion size={24} />} 
                />
                
                <MenuItem 
                  to="/how-it-works" 
                  label="How It Works" 
                  id="how-it-works"
                  icon={<FaRegCircleQuestion size={24} />} 
                />

                <StorageSection>
                  <StorageHeader>
                    <FiHardDrive size={14} />
                    <StorageTitle>Storage</StorageTitle>
                  </StorageHeader>
                  <StorageTrack>
                    <StorageFill $pct={Math.min(100, (storage.used / storage.max) * 100)} />
                  </StorageTrack>
                  <StorageText>
                    {formatBytes(storage.used)} of {formatBytes(storage.max)} used
                  </StorageText>
                </StorageSection>
              </OtherMenuSection>
            </SidebarContent>
          </MobileSidebar>
        </>
      )}
    </>
  );
}

const DesktopSidebar = styled.div`
  width: 230px;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
  position: fixed;
  top: 80px;
  left: 0;
  bottom: 0;
  background: white;
  z-index: 30;
  overflow-y: auto;

  @media (max-width: 1024px) {
    display: none;
  }
`;

const MobileSidebar = styled.div`
  width: 280px;
  max-width: 85vw;
  box-shadow: 2px 0 20px rgba(0, 0, 0, 0.15);
  position: fixed;
  top: 64px;
  left: 0;
  bottom: 0;
  background: white;
  z-index: 45;
  overflow-y: auto;
  animation: slideIn 0.3s ease-out;

  @keyframes slideIn {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
    }
  }

  @media (min-width: 1025px) {
    display: none;
  }
`;

const MobileBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 40;

  @media (min-width: 1025px) {
    display: none;
  }
`;

const SidebarContent = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
  padding: 24px 0;
`;

const MainMenuSection = styled.div`
  display: flex;
  flex-direction: column;
`;

const OtherMenuSection = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: auto;
`;

const SectionLabel = styled.div`
  padding: 0 24px;
  margin: 24px 0 8px 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const MenuLink = styled(Link)`
  text-decoration: none;
`;

const MenuItemWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 12px;
  padding: 12px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: ${props => props.$isActive ? '#dbeafe' : 'transparent'};

  &:hover {
    background-color: ${props => props.$isActive ? '#dbeafe' : '#f1f5f9'};
  }
`;

const IconWrapper = styled.div`
  display: flex;
  align-items: center;
  color: ${props => props.$isActive ? '#0284c7' : '#6b7280'};
  transition: color 0.2s ease;
`;

const MenuLabel = styled.div`
  font-size: 13px;
  color: ${props => props.$isActive ? '#1e40af' : '#374151'};
  font-weight: ${props => props.$isActive ? '500' : '400'};
  transition: all 0.2s ease;
`;

/* ── Storage Bar ── */

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const barGrow = keyframes`
  from { width: 0; }
  to   { width: var(--w); }
`;

const StorageSection = styled.div`
  margin: 20px 12px 8px;
  padding: 14px 16px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
`;

const StorageHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: #6b7280;
`;

const StorageTitle = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
`;

const StorageTrack = styled.div`
  height: 5px;
  background: #e2e8f0;
  border-radius: 99px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const StorageFill = styled.div`
  --w: ${(p) => p.$pct}%;
  height: 100%;
  width: var(--w);
  border-radius: 99px;
  background: ${(p) =>
    p.$pct > 90 ? '#ef4444' : p.$pct > 70 ? '#f97316' : '#0284c7'};
  animation: ${barGrow} 0.9s ease forwards;
  transition: background 0.3s;
`;

const StorageText = styled.p`
  font-size: 0.72rem;
  color: #94a3b8;
  margin: 0;
  line-height: 1.4;
`;