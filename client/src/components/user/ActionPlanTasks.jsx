import React, { useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import { HiMenuAlt3 } from "react-icons/hi";
import {
    FiPlus, FiTrash2, FiCheckCircle, FiCalendar,
    FiAlertCircle, FiClock, FiList, FiChevronLeft, FiChevronRight
} from "react-icons/fi";
import axios from "axios";
import Navbar from "./Navbar";
import Leftbar from "./Leftbar";
import { useAuth } from "./Login";
import { useNavigate } from "react-router-dom";
import ApiUrl from "../config/LocalConfigApi";

const STATUS_LIST = ["To Do", "In Progress", "Done"];

// Palette: slate/gray + blue + red only — no violet, orange, yellow
const STATUS_COLORS = {
    "To Do":       { bg: "#F1F5F9", text: "#334155", border: "#CBD5E1", dot: "#64748B" },
    "In Progress": { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", dot: "#3B82F6" },
    "Done":        { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0", dot: "#22C55E" },
};

const PRIORITY_COLORS = {
    High:   { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
    Medium: { bg: "#F1F5F9", text: "#475569", border: "#CBD5E1" },
    Low:    { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
};

const getTodayDateInputValue = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
};

const normalizeDateKey = (value) => {
    if (!value) return "";

    if (typeof value === "string") {
        const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match?.[1]) return match[1];
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return toDateKey(parsed);
};

const formatDateLabel = (dateStr) => {
    const safeDate = normalizeDateKey(dateStr);
    if (!safeDate) return "No due date";
    try {
        return new Date(`${safeDate}T00:00:00`).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
        });
    } catch { return safeDate; }
};

const formatMonthLabel = (date) =>
    date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

const toDateKey = (date) =>
    `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;

const buildCalendarCells = (monthDate) => {
    const year = monthDate.getFullYear(), month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
};

const isOverdue = (dateStr, status) => {
    const safeDate = normalizeDateKey(dateStr);
    if (!safeDate || status === "Done") return false;
    const today = new Date(); today.setHours(0,0,0,0);
    const due   = new Date(`${safeDate}T00:00:00`); due.setHours(0,0,0,0);
    return due < today;
};

const fadeUp = keyframes`from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}`;
const pulse  = keyframes`0%,100%{opacity:1}50%{opacity:.4}`;

/* ──────────────────────── Component ──────────────────────── */

function ActionPlanTasks() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [taskInput,      setTaskInput]      = useState("");
    const [priority,       setPriority]       = useState("Medium");
    const [dueDateInput,   setDueDateInput]   = useState("");
    const [selectedDate,   setSelectedDate]   = useState("");
    const [selectedStatus, setSelectedStatus] = useState("All");
    const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
    const [tasks,      setTasks]      = useState([]);
    const [isFetching, setIsFetching] = useState(true);

    const todayValue = useMemo(() => getTodayDateInputValue(), []);
    const todayLabel = useMemo(() => new Date().toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
    }), []);

    const currentCalendarMonth = useMemo(
        () => new Date(new Date().getFullYear(), new Date().getMonth() + calendarMonthOffset, 1),
        [calendarMonthOffset]
    );
    const calendarCells   = useMemo(() => buildCalendarCells(currentCalendarMonth), [currentCalendarMonth]);
    const calendarTaskMap = useMemo(() => tasks.reduce((acc, t) => {
        const key = normalizeDateKey(t.due_date);
        if (!key) return acc;
        acc[key] = [...(acc[key] || []), t];
        return acc;
    }, {}), [tasks]);

    const visibleMonthKey = `${currentCalendarMonth.getFullYear()}-${String(currentCalendarMonth.getMonth()+1).padStart(2,"0")}`;

    useEffect(() => { if (!loading && !user) navigate("/"); }, [loading, user, navigate]);

    useEffect(() => {
        if (!user) return;
        axios.get(`${ApiUrl.apiURL}/action-plan-tasks`, { withCredentials: true })
            .then(res => setTasks(res.data || []))
            .catch(() => setTasks([]))
            .finally(() => setIsFetching(false));
    }, [user]);

    const filteredTasks = useMemo(() => tasks.filter(t =>
        (selectedStatus === "All" || t.status === selectedStatus) &&
        (!selectedDate || normalizeDateKey(t.due_date) === selectedDate)
    ), [tasks, selectedStatus, selectedDate]);

    const groupedTasks = useMemo(() => STATUS_LIST.reduce((acc, s) => {
        acc[s] = filteredTasks.filter(t => t.status === s);
        return acc;
    }, {}), [filteredTasks]);

    const counts = useMemo(() => ({
        total:      tasks.length,
        todo:       tasks.filter(t => t.status === "To Do").length,
        inProgress: tasks.filter(t => t.status === "In Progress").length,
        done:       tasks.filter(t => t.status === "Done").length,
        overdue:    tasks.filter(t => isOverdue(t.due_date, t.status)).length,
        upcoming:   tasks.filter(t => t.due_date && t.status !== "Done").length,
    }), [tasks]);

    const addTask = async () => {
        if (!taskInput.trim()) return;
        try {
            const res = await axios.post(`${ApiUrl.apiURL}/action-plan-tasks`, {
                title: taskInput.trim(), priority, status: "To Do", dueDate: dueDateInput || null,
            }, { withCredentials: true });
            setTasks(prev => [res.data, ...prev]);
            setTaskInput(""); setPriority("Medium"); setDueDateInput("");
        } catch (err) { console.error("Failed to create task", err); }
    };

    const patchTask = async (id, payload, rollback) => {
        try {
            await axios.put(`${ApiUrl.apiURL}/action-plan-tasks/${id}`, payload, { withCredentials: true });
        } catch { setTasks(rollback); }
    };

    const updateStatus  = async (id, next) => {
        const snap = tasks;
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: next } : t));
        await patchTask(id, { status: next }, snap);
    };
    const updateDueDate = async (id, next) => {
        const snap = tasks;
        setTasks(prev => prev.map(t => t.id === id ? { ...t, due_date: next || null } : t));
        await patchTask(id, { dueDate: next || null }, snap);
    };
    const removeTask = async (id) => {
        const snap = tasks;
        setTasks(prev => prev.filter(t => t.id !== id));
        try { await axios.delete(`${ApiUrl.apiURL}/action-plan-tasks/${id}`, { withCredentials: true }); }
        catch { setTasks(snap); }
    };

    const hasFilters = selectedDate || selectedStatus !== "All";

    return (
        <PageWrapper>
            <Navbar user={user} activePath="/action-plan-tasks" />
            <Leftbar isMobileMenuOpen={isMobileSidebarOpen} closeMobileMenu={() => setIsMobileSidebarOpen(false)} />
            <MobileMenuButton onClick={() => setIsMobileSidebarOpen(true)}>
                <HiMenuAlt3 size={20} />
            </MobileMenuButton>

            <MainContent>
                <ContentWrapper>

                    {/* ── Page Header ── */}
                    <PageHeader>
                        <PageHeaderText>
                            <PageTitle>Action Plan Tasks</PageTitle>
                            <PageSubtitle>
                                Track and manage improvement tasks from your AI analysis — assign priorities, due dates, and monitor progress.
                            </PageSubtitle>
                        </PageHeaderText>
                        <HeaderBadge>Execution Planner</HeaderBadge>
                    </PageHeader>

                    {/* ── Summary ── */}
                    <SummaryGrid>
                        {[
                            { label: "Total Tasks",  value: counts.total,      icon: <FiList size={15}/> },
                            { label: "To Do",        value: counts.todo,       icon: <FiClock size={15}/> },
                            { label: "In Progress",  value: counts.inProgress, icon: <FiAlertCircle size={15}/> },
                            { label: "Done",         value: counts.done,       icon: <FiCheckCircle size={15}/> },
                        ].map(({ label, value, icon }) => (
                            <SummaryCard key={label}>
                                <SummaryIcon>{icon}</SummaryIcon>
                                <div>
                                    <SummaryLabel>{label}</SummaryLabel>
                                    <SummaryValue>{value}</SummaryValue>
                                </div>
                            </SummaryCard>
                        ))}
                    </SummaryGrid>

                    {/* ── Planner Grid ── */}
                    <PlannerGrid>

                        {/* Composer */}
                        <Card>
                            <CardTitle><FiPlus size={15}/>Create New Task</CardTitle>

                            <ComposerInput
                                value={taskInput}
                                onChange={e => setTaskInput(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && addTask()}
                                placeholder="e.g. Shorten intro to under 12 seconds…"
                            />

                            <FieldsRow>
                                <FieldGroup>
                                    <FieldLabel>Priority</FieldLabel>
                                    <StyledSelect value={priority} onChange={e => setPriority(e.target.value)}>
                                        <option>High</option>
                                        <option>Medium</option>
                                        <option>Low</option>
                                    </StyledSelect>
                                </FieldGroup>
                                <FieldGroup>
                                    <FieldLabel>Due Date</FieldLabel>
                                    <StyledDateInput type="date" value={dueDateInput} min={todayValue} onChange={e => setDueDateInput(e.target.value)} />
                                </FieldGroup>
                            </FieldsRow>

                            <AddButton onClick={addTask} disabled={!taskInput.trim()}>
                                <FiPlus size={14}/> Add to Plan
                            </AddButton>

                            <Tip>
                                <FiCheckCircle size={13}/>
                                Keep deadlines realistic. Review overdue tasks weekly and focus only on high-impact items.
                            </Tip>
                        </Card>

                        {/* Calendar */}
                        <Card>
                            <CalendarTop>
                                <div>
                                    <CardTitle style={{marginBottom:4}}><FiCalendar size={15}/>Task Calendar</CardTitle>
                                    <CalendarToday>{todayLabel}</CalendarToday>
                                </div>
                                <CalendarNav>
                                    <NavBtn onClick={() => setCalendarMonthOffset(p => p - 1)} title="Previous month">
                                        <FiChevronLeft size={14}/>
                                    </NavBtn>
                                    <NavBtn onClick={() => setCalendarMonthOffset(0)}>Today</NavBtn>
                                    <NavBtn onClick={() => setCalendarMonthOffset(p => p + 1)} title="Next month">
                                        <FiChevronRight size={14}/>
                                    </NavBtn>
                                </CalendarNav>
                            </CalendarTop>

                            <MonthLabel>{formatMonthLabel(currentCalendarMonth)}</MonthLabel>

                            <WeekdayRow>
                                {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                                    <WeekdayCell key={d}>{d}</WeekdayCell>
                                ))}
                            </WeekdayRow>

                            <CalGrid>
                                {calendarCells.map((date, idx) => {
                                    if (!date) return <EmptyCell key={`e-${idx}`}/>;
                                    const key        = toDateKey(date);
                                    const dayTasks   = calendarTaskMap[key] || [];
                                    const isToday    = key === todayValue;
                                    const isSelected = selectedDate === key;
                                    const inMonth    = key.startsWith(visibleMonthKey);
                                    const hasOverdue = dayTasks.some(t => isOverdue(t.due_date, t.status));

                                    return (
                                        <DayCell
                                            key={key}
                                            onClick={() => setSelectedDate(isSelected ? "" : key)}
                                            $today={isToday}
                                            $selected={isSelected}
                                            $dim={!inMonth}
                                            $overdue={hasOverdue}
                                            title={dayTasks.length ? `${dayTasks.length} task(s)` : ""}
                                        >
                                            <DayNumber $today={isToday} $selected={isSelected}>
                                                {date.getDate()}
                                            </DayNumber>
                                            {dayTasks.length > 0 && (
                                                <DayDots>
                                                    {dayTasks.slice(0,3).map(t => (
                                                        <TaskDot
                                                            key={t.id}
                                                            $color={isOverdue(t.due_date, t.status) ? "#DC2626" : STATUS_COLORS[t.status]?.dot}
                                                        />
                                                    ))}
                                                    {dayTasks.length > 3 && <MoreLabel>+{dayTasks.length-3}</MoreLabel>}
                                                </DayDots>
                                            )}
                                        </DayCell>
                                    );
                                })}
                            </CalGrid>

                            {selectedDate && calendarTaskMap[selectedDate]?.length > 0 && (
                                <SelectedPanel>
                                    <SelectedPanelTitle>
                                        <FiCalendar size={12}/>
                                        {formatDateLabel(selectedDate)}
                                        <CountBadge>{calendarTaskMap[selectedDate].length}</CountBadge>
                                    </SelectedPanelTitle>
                                    {calendarTaskMap[selectedDate].map(t => (
                                        <SelectedRow key={t.id}>
                                            <RowDot $color={STATUS_COLORS[t.status]?.dot}/>
                                            <RowText>{t.title}</RowText>
                                            <SmallPill $p={t.priority}>{t.priority}</SmallPill>
                                        </SelectedRow>
                                    ))}
                                </SelectedPanel>
                            )}

                            <Divider/>

                            <FilterRow>
                                <FieldGroup>
                                    <FieldLabel>Filter by date</FieldLabel>
                                    <StyledDateInput type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                                </FieldGroup>
                                <FieldGroup>
                                    <FieldLabel>Filter by status</FieldLabel>
                                    <StyledSelect value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
                                        <option value="All">All Status</option>
                                        <option>To Do</option>
                                        <option>In Progress</option>
                                        <option>Done</option>
                                    </StyledSelect>
                                </FieldGroup>
                            </FilterRow>

                            <MiniStats>
                                <MiniStat>
                                    <FiClock size={13}/><span>Upcoming</span><strong>{counts.upcoming}</strong>
                                </MiniStat>
                                <MiniStat $danger>
                                    <FiAlertCircle size={13}/><span>Overdue</span><strong>{counts.overdue}</strong>
                                </MiniStat>
                            </MiniStats>

                            {hasFilters && (
                                <ClearBtn onClick={() => { setSelectedDate(""); setSelectedStatus("All"); }}>
                                    Clear Filters
                                </ClearBtn>
                            )}
                        </Card>
                    </PlannerGrid>

                    {/* ── Board ── */}
                    <BoardBar>
                        <FiList size={14}/>
                        {hasFilters ? "Filtered Tasks" : "All Tasks"}
                        {hasFilters && (
                            <ClearInline onClick={() => { setSelectedDate(""); setSelectedStatus("All"); }}>
                                Clear filters
                            </ClearInline>
                        )}
                    </BoardBar>

                    {isFetching ? (
                        <LoadingBox>
                            <LoadDot/><LoadDot $d=".15s"/><LoadDot $d=".3s"/>
                            <span>Loading tasks…</span>
                        </LoadingBox>
                    ) : (
                        <BoardGrid>
                            {STATUS_LIST.map(status => {
                                const col = STATUS_COLORS[status];
                                return (
                                    <Column key={status}>
                                        <ColumnHeader $border={col.border}>
                                            <ColLeft>
                                                <ColDot $color={col.dot}/>
                                                <ColTitle>{status}</ColTitle>
                                            </ColLeft>
                                            <ColCount>{groupedTasks[status]?.length || 0}</ColCount>
                                        </ColumnHeader>

                                        <ColumnBody>
                                            {(groupedTasks[status] || []).length === 0 ? (
                                                <ColEmpty>No tasks</ColEmpty>
                                            ) : (
                                                groupedTasks[status].map(task => {
                                                    const overdue = isOverdue(task.due_date, task.status);
                                                    return (
                                                        <TaskCard key={task.id} $overdue={overdue}>
                                                            <TaskTitle>{task.title}</TaskTitle>

                                                            <TagRow>
                                                                <PriorityTag $p={task.priority}>
                                                                    {task.priority}
                                                                </PriorityTag>
                                                                {overdue && (
                                                                    <OverdueTag>
                                                                        <FiAlertCircle size={11}/>Overdue
                                                                    </OverdueTag>
                                                                )}
                                                            </TagRow>

                                                            <DateRow $overdue={overdue}>
                                                                <FiCalendar size={12}/>
                                                                {formatDateLabel(task.due_date)}
                                                            </DateRow>

                                                            <TaskFieldsRow>
                                                                <FieldGroup>
                                                                    <FieldLabel>Status</FieldLabel>
                                                                    <StyledSelect
                                                                        value={task.status}
                                                                        onChange={e => updateStatus(task.id, e.target.value)}
                                                                    >
                                                                        <option>To Do</option>
                                                                        <option>In Progress</option>
                                                                        <option>Done</option>
                                                                    </StyledSelect>
                                                                </FieldGroup>
                                                                <FieldGroup>
                                                                    <FieldLabel>Due</FieldLabel>
                                                                    <StyledDateInput
                                                                        type="date"
                                                                        value={normalizeDateKey(task.due_date)}
                                                                        min={todayValue}
                                                                        onChange={e => updateDueDate(task.id, e.target.value)}
                                                                    />
                                                                </FieldGroup>
                                                            </TaskFieldsRow>

                                                            <DeleteButton onClick={() => removeTask(task.id)}>
                                                                <FiTrash2 size={13}/> Remove
                                                            </DeleteButton>
                                                        </TaskCard>
                                                    );
                                                })
                                            )}
                                        </ColumnBody>
                                    </Column>
                                );
                            })}
                        </BoardGrid>
                    )}
                </ContentWrapper>
            </MainContent>
        </PageWrapper>
    );
}

export default ActionPlanTasks;

/* ──────────────────────── Styles ──────────────────────── */

const PageWrapper = styled.div`
    min-height: 100vh;
    background: #F8FAFC;
    font-family: 'Inter', system-ui, sans-serif;
`;

const MainContent = styled.main`
    margin-left: 230px;
    margin-top: 68px;
    min-height: calc(100vh - 68px);
    padding: 28px 24px;
    @media (max-width: 1024px) { margin-left: 0; margin-top: 64px; padding: 16px; }
`;

const MobileMenuButton = styled.button`
    display: none;
    @media (max-width: 1024px) {
        display: grid; place-items: center; position: fixed;
        top: 76px; left: 14px; width: 40px; height: 40px;
        border-radius: 10px; border: 1px solid #E2E8F0;
        background: #fff; color: #1E293B; z-index: 60;
        box-shadow: 0 2px 8px rgba(0,0,0,.07); cursor: pointer;
    }
`;

const ContentWrapper = styled.div`
    width: 100%; max-width: 1160px; margin: 0 auto;
    display: flex; flex-direction: column; gap: 18px;
    animation: ${fadeUp} .35s ease;
`;

/* Header — simple white card, no bg color */
const PageHeader = styled.section`
    background: #ffffff;
    border: 1px solid #E2E8F0;
    border-radius: 14px;
    padding: 24px 28px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
`;
const PageHeaderText = styled.div``;
const PageTitle = styled.h1`
    font-size: clamp(1.2rem, 2vw, 1.5rem);
    font-weight: 800;
    color: #0F172A;
    margin: 0 0 6px;
`;
const PageSubtitle = styled.p`
    color: #64748B;
    font-size: .875rem;
    margin: 0;
    max-width: 60ch;
    line-height: 1.6;
`;
const HeaderBadge = styled.span`
    flex-shrink: 0;
    padding: 5px 12px;
    border-radius: 999px;
    border: 1px solid #CBD5E1;
    background: #F1F5F9;
    color: #475569;
    font-size: .68rem;
    font-weight: 700;
    letter-spacing: .05em;
    text-transform: uppercase;
    white-space: nowrap;
`;

/* Summary */
const SummaryGrid = styled.section`
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 12px;
    @media (max-width: 760px) { grid-template-columns: repeat(2, minmax(0,1fr)); }
`;
const SummaryCard = styled.div`
    background: #fff;
    border: 1px solid #E2E8F0;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: box-shadow .15s;
    &:hover { box-shadow: 0 3px 10px rgba(0,0,0,.06); }
`;
const SummaryIcon = styled.div`
    width: 36px; height: 36px; border-radius: 8px;
    background: #F1F5F9; color: #64748B;
    display: grid; place-items: center; flex-shrink: 0;
`;
const SummaryLabel = styled.div`
    font-size: .68rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: .05em; color: #94A3B8;
`;
const SummaryValue = styled.div`
    font-size: 1.45rem; font-weight: 800; color: #0F172A; margin-top: 2px;
`;

/* Card base */
const Card = styled.section`
    background: #fff;
    border: 1px solid #E2E8F0;
    border-radius: 14px;
    padding: 20px;
`;
const CardTitle = styled.h2`
    display: flex; align-items: center; gap: 7px;
    font-size: .88rem; font-weight: 700; color: #0F172A; margin: 0 0 14px;
`;

/* Planner grid */
const PlannerGrid = styled.section`
    display: grid;
    grid-template-columns: 1fr 1.15fr;
    gap: 14px;
    @media (max-width: 960px) { grid-template-columns: 1fr; }
`;

/* Shared form elements */
const FieldsRow = styled.div`
    margin-top: 11px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
`;
const FieldGroup = styled.div`display: flex; flex-direction: column; gap: 5px;`;
const FieldLabel = styled.label`
    font-size: .68rem; font-weight: 700; letter-spacing: .05em;
    text-transform: uppercase; color: #64748B;
`;
const StyledSelect = styled.select`
    height: 36px; border: 1px solid #CBD5E1; border-radius: 7px;
    padding: 0 9px; color: #334155; background: #fff; font-size: .82rem; cursor: pointer;
    &:focus { outline: none; border-color: #94A3B8; }
`;
const StyledDateInput = styled.input`
    height: 36px; border: 1px solid #CBD5E1; border-radius: 7px;
    padding: 0 9px; color: #334155; background: #fff; font-size: .82rem;
    &:focus { outline: none; border-color: #94A3B8; }
`;

/* Composer */
const ComposerInput = styled.input`
    width: 100%; height: 42px;
    border: 1px solid #CBD5E1; border-radius: 8px;
    padding: 0 13px; font-size: .875rem; color: #0F172A; background: #F8FAFC;
    transition: border-color .15s, box-shadow .15s;
    &::placeholder { color: #94A3B8; }
    &:focus { outline: none; border-color: #64748B; box-shadow: 0 0 0 3px rgba(100,116,139,.1); background: #fff; }
`;
const AddButton = styled.button`
    margin-top: 13px; height: 40px; width: 100%;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    border: none; border-radius: 8px;
    background: #1E293B; color: #fff;
    font-size: .84rem; font-weight: 700; cursor: pointer;
    opacity: ${p => p.disabled ? .4 : 1};
    transition: opacity .15s, background .15s, transform .12s, box-shadow .12s;
    &:not(:disabled):hover { background: #0F172A; box-shadow: 0 4px 12px rgba(15,23,42,.22); transform: translateY(-1px); }
    &:not(:disabled):active { transform: translateY(0); }
`;
const Tip = styled.p`
    margin-top: 13px; display: flex; align-items: flex-start; gap: 7px;
    padding: 10px 12px; background: #F8FAFC; border: 1px solid #E2E8F0;
    border-radius: 8px; color: #64748B; font-size: .77rem; line-height: 1.5; margin-bottom: 0;
`;

/* Calendar */
const CalendarTop = styled.div`
    display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
    margin-bottom: 4px;
`;
const CalendarToday = styled.p`
    color: #94A3B8; font-size: .72rem; margin: 2px 0 0;
`;
const CalendarNav = styled.div`display: flex; align-items: center; gap: 4px; flex-shrink: 0;`;
const NavBtn = styled.button`
    height: 30px; padding: 0 10px;
    border: 1px solid #CBD5E1; border-radius: 7px;
    background: #fff; color: #475569;
    font-size: .75rem; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; gap: 3px;
    transition: border-color .12s, background .12s, color .12s;
    &:hover { border-color: #64748B; background: #F1F5F9; color: #1E293B; }
`;
const MonthLabel = styled.div`
    margin: 10px 0 8px; color: #0F172A; font-size: .95rem; font-weight: 800;
`;
const WeekdayRow = styled.div`
    display: grid; grid-template-columns: repeat(7, minmax(0,1fr)); gap: 3px; margin-bottom: 4px;
`;
const WeekdayCell = styled.span`
    text-align: center; color: #94A3B8;
    font-size: .62rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 3px 0;
`;
const CalGrid = styled.div`
    display: grid; grid-template-columns: repeat(7, minmax(0,1fr)); gap: 3px;
`;
const EmptyCell = styled.div`min-height: 44px;`;

/* Calendar day cell — dots only, no text overflow */
const DayCell = styled.button`
    min-height: 44px; border-radius: 7px; padding: 5px 3px 4px;
    border: 1px solid ${p =>
        p.$selected ? "#334155" :
        p.$overdue  ? "#FECACA" :
        p.$today    ? "#94A3B8" : "#E8EDF2"};
    background: ${p =>
        p.$selected ? "#1E293B" :
        p.$overdue  ? "#FFF5F5" :
        p.$today    ? "#F1F5F9" : "#FAFBFC"};
    cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px;
    opacity: ${p => p.$dim ? .4 : 1};
    transition: border-color .12s, background .12s;
    &:hover { border-color: #64748B; background: ${p => p.$selected ? "#0F172A" : "#F1F5F9"}; }
`;
const DayNumber = styled.span`
    font-size: .76rem;
    font-weight: ${p => (p.$today || p.$selected) ? 800 : 500};
    color: ${p => p.$selected ? "#fff" : p.$today ? "#1E293B" : "#475569"};
    line-height: 1;
`;
const DayDots = styled.div`
    display: flex; align-items: center; justify-content: center; gap: 2px;
`;
const TaskDot = styled.div`
    width: 5px; height: 5px; border-radius: 50%;
    background: ${p => p.$color || "#64748B"}; flex-shrink: 0;
`;
const MoreLabel = styled.span`font-size: .5rem; font-weight: 700; color: #94A3B8; line-height: 1;`;

/* Selected day panel */
const SelectedPanel = styled.div`
    margin-top: 10px; padding: 10px 12px;
    background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px;
    display: flex; flex-direction: column; gap: 5px;
`;
const SelectedPanelTitle = styled.div`
    display: flex; align-items: center; gap: 6px;
    font-size: .72rem; font-weight: 700; color: #475569; margin-bottom: 3px;
`;
const CountBadge = styled.span`
    margin-left: auto; background: #E2E8F0; border-radius: 999px;
    padding: 1px 8px; font-size: .65rem; color: #64748B; font-weight: 600;
`;
const SelectedRow = styled.div`
    display: flex; align-items: center; gap: 8px; padding: 6px 8px;
    background: #fff; border: 1px solid #E2E8F0; border-radius: 7px;
`;
const RowDot = styled.div`
    width: 7px; height: 7px; border-radius: 50%; background: ${p => p.$color}; flex-shrink: 0;
`;
const RowText = styled.span`
    flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: .78rem; color: #334155;
`;
const SmallPill = styled.span`
    padding: 2px 7px; border-radius: 999px; font-size: .62rem; font-weight: 700; flex-shrink: 0;
    color:      ${p => PRIORITY_COLORS[p.$p]?.text};
    background: ${p => PRIORITY_COLORS[p.$p]?.bg};
    border: 1px solid ${p => PRIORITY_COLORS[p.$p]?.border};
`;

const Divider = styled.hr`border: none; border-top: 1px solid #E8EDF2; margin: 12px 0;`;
const FilterRow = styled.div`display: grid; grid-template-columns: 1fr 1fr; gap: 8px;`;

const MiniStats = styled.div`
    margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
`;
const MiniStat = styled.div`
    display: flex; align-items: center; gap: 7px;
    padding: 9px 12px; border-radius: 8px;
    border: 1px solid ${p => p.$danger ? "#FECACA" : "#E2E8F0"};
    background: ${p => p.$danger ? "#FFF5F5" : "#F8FAFC"};
    color: ${p => p.$danger ? "#B91C1C" : "#475569"};
    font-size: .78rem;
    span { flex: 1; }
    strong { font-weight: 800; color: #0F172A; }
`;
const ClearBtn = styled.button`
    margin-top: 8px; width: 100%; height: 34px;
    border: 1px solid #CBD5E1; border-radius: 7px;
    background: #fff; color: #64748B; font-size: .78rem; font-weight: 600; cursor: pointer;
    transition: border-color .12s, color .12s;
    &:hover { border-color: #94A3B8; color: #334155; }
`;

/* Board */
const BoardBar = styled.div`
    display: flex; align-items: center; gap: 7px;
    color: #475569; font-size: .82rem; font-weight: 700;
    padding-bottom: 10px; border-bottom: 1px solid #E2E8F0;
`;
const ClearInline = styled.button`
    border: none; background: none; color: #64748B; font-size: .75rem;
    font-weight: 600; cursor: pointer; text-decoration: underline; margin-left: 4px;
    &:hover { color: #334155; }
`;
const LoadingBox = styled.div`
    display: flex; align-items: center; justify-content: center; gap: 8px; padding: 40px;
    background: #fff; border: 1px solid #E2E8F0; border-radius: 14px;
    color: #94A3B8; font-size: .85rem;
`;
const LoadDot = styled.div`
    width: 7px; height: 7px; border-radius: 50%; background: #CBD5E1;
    animation: ${pulse} 1.2s ease ${p => p.$d || "0s"} infinite;
`;
const BoardGrid = styled.section`
    display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 12px;
    @media (max-width: 1000px) { grid-template-columns: 1fr; }
`;
const Column = styled.div`
    background: #fff; border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden;
`;
const ColumnHeader = styled.div`
    padding: 11px 14px;
    border-bottom: 1px solid ${p => p.$border || "#E2E8F0"};
    display: flex; align-items: center; justify-content: space-between;
    background: #FAFBFC;
`;
const ColLeft = styled.div`display: flex; align-items: center; gap: 8px;`;
const ColDot = styled.div`width: 8px; height: 8px; border-radius: 50%; background: ${p => p.$color};`;
const ColTitle = styled.h3`font-size: .85rem; font-weight: 700; color: #0F172A; margin: 0;`;
const ColCount = styled.span`
    min-width: 22px; height: 22px; border-radius: 999px; padding: 0 6px;
    display: grid; place-items: center;
    background: #E2E8F0; color: #475569; font-size: .72rem; font-weight: 800;
`;
const ColumnBody = styled.div`padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 200px;`;
const ColEmpty = styled.div`
    border: 1px dashed #CBD5E1; border-radius: 9px; padding: 22px 10px;
    text-align: center; color: #94A3B8; font-size: .8rem;
`;
const TaskCard = styled.article`
    border: 1px solid ${p => p.$overdue ? "#FECACA" : "#E2E8F0"};
    border-radius: 10px; padding: 12px;
    background: ${p => p.$overdue ? "#FFF8F8" : "#fff"};
    transition: box-shadow .15s, transform .12s;
    &:hover { box-shadow: 0 3px 10px rgba(0,0,0,.07); transform: translateY(-1px); }
`;
const TaskTitle = styled.h4`color: #0F172A; font-size: .84rem; font-weight: 700; line-height: 1.45; margin: 0;`;
const TagRow = styled.div`margin-top: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;`;
const PriorityTag = styled.span`
    border-radius: 999px; padding: 3px 9px;
    font-size: .63rem; font-weight: 700; letter-spacing: .03em; text-transform: uppercase;
    color:      ${p => PRIORITY_COLORS[p.$p]?.text};
    background: ${p => PRIORITY_COLORS[p.$p]?.bg};
    border: 1px solid ${p => PRIORITY_COLORS[p.$p]?.border};
`;
const OverdueTag = styled.span`
    border-radius: 999px; padding: 3px 9px;
    font-size: .63rem; font-weight: 700; text-transform: uppercase;
    color: #B91C1C; background: #FEE2E2; border: 1px solid #FECACA;
    display: inline-flex; align-items: center; gap: 4px;
`;
const DateRow = styled.div`
    margin-top: 7px; display: flex; align-items: center; gap: 5px;
    color: ${p => p.$overdue ? "#DC2626" : "#64748B"};
    font-size: .75rem; font-weight: ${p => p.$overdue ? 600 : 400};
`;
const TaskFieldsRow = styled.div`margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;`;
const DeleteButton = styled.button`
    margin-top: 10px; height: 32px; width: 100%; border-radius: 7px;
    border: 1px solid #FECACA; background: #FFF5F5; color: #DC2626;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    cursor: pointer; font-size: .75rem; font-weight: 700;
    transition: background .15s;
    &:hover { background: #FEE2E2; }
`;