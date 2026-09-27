import React, { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { HiMenuAlt3 } from "react-icons/hi";
import Navbar from "./Navbar";
import Leftbar from "./Leftbar";
import { useAuth } from "./Login";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import axios from "axios";
import ApiUrl from "../config/LocalConfigApi";

function Profile() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    const [formData, setFormData] = useState({
        fullName: "",
        contactNumber: "",
        address: "",
    });

    useEffect(() => {
        if (!loading && !user) {
            navigate("/");
        }
    }, [loading, user, navigate]);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await axios.get(`${ApiUrl.apiURL}/user/me/profile`, {
                    withCredentials: true,
                });
                if (response.data) {
                    setFormData((prev) => ({
                        ...prev,
                        fullName: response.data.full_name || "",
                        contactNumber: response.data.contact_number || "",
                        address: response.data.address || "",
                    }));
                }
            } catch (err) {
                console.error("Error fetching user data:", err);
            }
        };

        if (user) {
            fetchUserData();
        }
    }, [user]);

    useEffect(() => {
        if (user?.acc_email) {
            const name = user.acc_email.split("@")[0] || "";
            setFormData((prev) => ({
                ...prev,
                fullName: name,
            }));
        }
    }, [user]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === "contactNumber") {
            // Allow only digits and limit to 11 characters
            if (/^\d*$/.test(value) && value.length <= 11) {
                setFormData((prev) => ({ ...prev, [name]: value }));
            }
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const showAlert = (title, text, icon) => {
        Swal.fire({
            title,
            text,
            icon,
            confirmButtonText: "OK",
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if(!formData.fullName.trim()) {
            showAlert("Validation Error", "Full Name is required.", "error");
            return;
        }

        if (formData.contactNumber && formData.address) {
            try {
                await axios.put(`${ApiUrl.apiURL}/user/me/profile`, formData, {
                    withCredentials: true,
                });
                await showAlert("Success", "Profile updated successfully!", "success");
            } catch (error) {
                console.error("Error updating profile:", error);
                showAlert("Error", "Failed to update profile. Please try again.", "error");
            }
        } else {
            showAlert("Validation Error", "Please fill in all required fields.", "error");
        }
    };

    if (loading) {
        return (
            <LoadingScreen>
                <LoadingSpinner />
            </LoadingScreen>
        );
    }

    return (
        <PageWrapper>
            <Navbar user={user} activePath="/profile" />
            <Leftbar
                isMobileMenuOpen={isMobileSidebarOpen}
                closeMobileMenu={() => setIsMobileSidebarOpen(false)}
            />

            <MobileMenuButton onClick={() => setIsMobileSidebarOpen(true)}>
                <HiMenuAlt3 size={24} />
            </MobileMenuButton>

            <MainContent>
                <ContentWrapper>
                    <HeaderCard>
                        <HeaderText>
                            <PageTitle>Profile Settings</PageTitle>
                            <PageSubtitle>
                                Update your basic profile details.
                            </PageSubtitle>
                        </HeaderText>
                        <PlanBadge>Member Account</PlanBadge>
                    </HeaderCard>

                    <ProfileForm onSubmit={handleSubmit}>
                        <FormCard>
                            <CardTitle>Personal Information</CardTitle>
                            <CardSubtitle>Keep your core profile details updated.</CardSubtitle>

                            <FieldGroup>
                                <FieldLabel htmlFor="fullName">Full Name</FieldLabel>
                                <TextInput
                                    id="fullName"
                                    name="fullName"
                                    placeholder="Enter your full name"
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                />
                            </FieldGroup>

                            <FieldGroup>
                                <FieldLabel htmlFor="contactNumber">Contact Number</FieldLabel>
                                <TextInput
                                    id="contactNumber"
                                    name="contactNumber"
                                    placeholder="e.g. +63 912 345 6789"
                                    value={formData.contactNumber}
                                    onChange={handleInputChange}
                                />
                            </FieldGroup>

                            <FieldGroup>
                                <FieldLabel htmlFor="address">Address</FieldLabel>
                                <TextInput
                                    id="address"
                                    name="address"
                                    placeholder="Enter your full address"
                                    value={formData.address}
                                    onChange={handleInputChange}
                                />
                            </FieldGroup>
                        </FormCard>

                        <ActionBar>
                            <SecondaryButton type="button">Cancel</SecondaryButton>
                            <PrimaryButton type="submit">Save Changes</PrimaryButton>
                        </ActionBar>
                    </ProfileForm>
                </ContentWrapper>
            </MainContent>
        </PageWrapper>
    );
}

export default Profile;

const spin = keyframes`
    to { transform: rotate(360deg); }
`;

const LoadingScreen = styled.div`
    height: 100vh;
    display: grid;
    place-items: center;
    background: #f9fafb;
`;

const LoadingSpinner = styled.div`
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid #e5e7eb;
    border-top-color: #0284c7;
    animation: ${spin} 0.8s linear infinite;
`;

const PageWrapper = styled.div`
    min-height: 100vh;
    background: #f9fafb;
`;

const MainContent = styled.main`
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
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
`;

const HeaderCard = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 22px;

    @media (max-width: 640px) {
        flex-direction: column;
    }
`;

const HeaderText = styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
`;

const PageTitle = styled.h1`
    font-size: clamp(1.25rem, 2vw, 1.6rem);
    line-height: 1.2;
    color: #1f2937;
    font-weight: 700;
`;

const PageSubtitle = styled.p`
    font-size: 0.92rem;
    color: #6b7280;
    line-height: 1.55;
    max-width: 60ch;
`;

const PlanBadge = styled.span`
    align-self: center;
    padding: 8px 14px;
    border-radius: 999px;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1e40af;
    font-size: 0.78rem;
    font-weight: 600;
`;

const ProfileForm = styled.form`
    display: flex;
    flex-direction: column;
    gap: 18px;
`;

const FormCard = styled.section`
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
`;

const CardTitle = styled.h2`
    font-size: 1.05rem;
    color: #1f2937;
    font-weight: 600;
`;

const CardSubtitle = styled.p`
    font-size: 0.84rem;
    color: #6b7280;
    margin-bottom: 4px;
`;

const FieldGroup = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const FieldLabel = styled.label`
    font-size: 0.82rem;
    color: #374151;
    font-weight: 500;
`;

const inputStyles = `
    width: 100%;
    border: 1px solid #d1d5db;
    background: #ffffff;
    border-radius: 10px;
    padding: 11px 12px;
    font-size: 0.9rem;
    color: #1f2937;
    outline: none;

    &::placeholder {
        color: #9ca3af;
    }

    &:focus {
        border-color: #0284c7;
        box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.16);
    }
`;

const TextInput = styled.input`
    ${inputStyles}
`;

const ActionBar = styled.div`
    display: flex;
    justify-content: flex-end;
    gap: 10px;
`;

const PrimaryButton = styled.button`
    border: 0;
    border-radius: 10px;
    padding: 10px 16px;
    color: white;
    font-size: 0.88rem;
    font-weight: 600;
    background: linear-gradient(135deg, #075985 0%, #0284c7 100%);
    cursor: pointer;

    &:hover {
        filter: brightness(1.05);
    }
`;

const SecondaryButton = styled.button`
    border: 1px solid #d1d5db;
    border-radius: 10px;
    padding: 10px 16px;
    color: #374151;
    font-size: 0.88rem;
    font-weight: 500;
    background: white;
    cursor: pointer;

    &:hover {
        background: #f9fafb;
        border-color: #9ca3af;
    }
`;
