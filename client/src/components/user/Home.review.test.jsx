import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import Swal from 'sweetalert2';
import Home from './Home';
jest.mock('axios', () => ({ defaults: {}, get: jest.fn(), post: jest.fn() }));
jest.mock('sweetalert2', () => ({ fire: jest.fn(), getHtmlContainer: jest.fn() }));
jest.mock('./Login', () => { const user = { name: 'Reviewer' }; return { useAuth: () => ({ user, loading: false }) }; });
jest.mock('./Navbar', () => () => null);
jest.mock('./Leftbar', () => () => null);
jest.mock('./Rightbar.jsx', () => () => null);
jest.mock('react-router-dom', () => ({ useLocation: () => ({ state: null }), useParams: () => ({}), useNavigate: () => jest.fn(), Link: ({ children }) => <span>{children}</span> }), { virtual: true });
class MockEventSource {
    static instances = [];
    constructor(url, options) { this.url = url; this.options = options; this.listeners = {}; MockEventSource.instances.push(this); }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    close = jest.fn();
    emit(name, value) { this.listeners[name]({ data: JSON.stringify(value) }); }
}
const pending = { review_id: 'server-reference', analysis_status: 'awaiting_acknowledgement', community_standards: {
    state: 'flagged', violation_details: [{ category: 'smoking_vaping_or_tobacco', reason: 'The presenter promotes smoking.' },
        { category: 'illegal_drugs_or_drug_use', reason: 'The message promotes drug use.', timestamp: '00:05' }] } };
beforeEach(() => {
    localStorage.clear(); jest.clearAllMocks(); MockEventSource.instances = [];
    global.EventSource = MockEventSource;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ videoPath: 'uploads/retained.mp4' }) });
    URL.createObjectURL = jest.fn(() => 'blob:video');
    axios.get.mockResolvedValue({ data: [] });
    Swal.fire.mockResolvedValue({ isConfirmed: true });
    axios.post.mockResolvedValue({ data: { analysis_status: 'completed_flagged', community_standards: pending.community_standards,
        guideline_acknowledged_at: '2026-11-08T01:00:00Z', summary: {} } });
});
async function start() {
    const { container } = render(<Home />);
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [new File(['video'], 'ad.mp4', { type: 'video/mp4' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Video' }));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(1));
    return MockEventSource.instances[0];
}
test('flag dialog lists findings; proceed reuses uploaded video and sends server reference', async () => {
    const stream = await start();
    await act(async () => { stream.emit('review', { data: pending }); });
    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/process-video'), {
        videoPath: 'uploads/retained.mp4', reviewId: 'server-reference', action: 'proceed',
    }, { withCredentials: true }));
    expect(Swal.fire.mock.calls[0][0]).toMatchObject({ confirmButtonText: 'Proceed with analysis', cancelButtonText: 'Cancel' });
    expect(Swal.fire.mock.calls[0][0].text).toContain('The presenter promotes smoking.');
    expect(Swal.fire.mock.calls[0][0].text).toContain('The message promotes drug use.');
    expect(Swal.fire.mock.calls[0][0].text.match(/Time:/g)).toHaveLength(1);
    expect(Swal.fire.mock.calls[0][0]).not.toHaveProperty('html');
    expect(stream.options.withCredentials).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toHaveTextContent('Analyzed with guideline flags');
});
test('cancel records cancellation and does not show completed analysis', async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: false });
    axios.post.mockResolvedValue({ data: { analysis_status: 'cancelled' } });
    const stream = await start();
    await act(async () => { stream.emit('review', { data: pending }); });
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/process-video'), expect.objectContaining({ action: 'cancel', reviewId: 'server-reference' }), { withCredentials: true });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
});
test('processing failure retains uploaded path and retry does not re-upload', async () => {
    const stream = await start();
    await act(async () => { stream.emit('error', { message: 'Guideline review failed. Please retry.', review_state: 'review_failed' }); });
    expect(await screen.findByRole('button', { name: 'Analyze Video' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Video' }));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2));
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { MockEventSource.instances[1].emit('error', { message: 'Stop test' }); });
});
