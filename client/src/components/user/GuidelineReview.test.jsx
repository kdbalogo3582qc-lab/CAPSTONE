import React from 'react';
import { render, screen } from '@testing-library/react';
import { GuidelineBadge, GuidelineFindings } from './GuidelineReview';
const flagged = { analysis_status: 'completed_flagged', guideline_acknowledged_at: '2026-11-08T01:02:03.000Z',
    community_standards: { state: 'flagged', violation_details: [
        { category: 'smoking_vaping_or_tobacco', reason: 'The speaker promotes cigarettes.' },
        { category: 'illegal_drugs_or_drug_use', reason: 'The speaker encourages drug use.', timestamp: '00:04', transcript_excerpt: 'Supported excerpt' },
    ] } };
test('saved JSON shows badge, findings and acknowledgement without fabricated timestamps', () => {
    render(<GuidelineFindings analysis={JSON.stringify(flagged)} />);
    expect(screen.getByRole('status')).toHaveTextContent('Analyzed with guideline flags');
    expect(screen.getByText(/The speaker promotes cigarettes/)).toBeInTheDocument();
    expect(screen.getAllByText(/Time:/)).toHaveLength(1);
    expect(screen.getByText('Supported excerpt')).toBeInTheDocument();
    expect(screen.getByText(/Acknowledged:/)).not.toHaveTextContent('Not recorded');
});
test.each([null, '{bad}', { summary: 'Legacy saved record' }, { analysis_status: 'completed' }])('legacy, passed or invalid records do not acquire a flagged badge: %p', value => {
    const { container } = render(<GuidelineBadge analysis={value} />);
    expect(container).toBeEmptyDOMElement();
});
