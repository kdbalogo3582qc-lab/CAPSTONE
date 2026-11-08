"""Exercise production parser and multimodal function with a fake provider, without API credentials."""
import ast
import json
import logging
import os
from pathlib import Path
import tempfile
import unittest
from types import SimpleNamespace as NS

source = ast.parse((Path(__file__).parents[1] / 'python_script.py').read_text())
names = {'COMMUNITY_STANDARDS_CATEGORIES', 'COMMUNITY_STANDARDS_CLEAR_STATUSES', 'COMMUNITY_STANDARDS_PROMPT'}
functions = {'_normalize_community_standards', '_parse_json_object', '_provider_text', 'transcribe_and_translate_audio'}
selected = [n for n in source.body if (isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id in names for t in n.targets)) or (isinstance(n, ast.FunctionDef) and n.name in functions)]
scope = {'os': os, 'json': json, 'logging': logging, 'MODEL_ID': 'mock-model',
         'sanitize_media_file': lambda p: p, '_build_comments_block': lambda c: '',
         'types': NS(Part=NS(from_bytes=lambda **kwargs: kwargs))}
exec(compile(ast.Module(body=selected, type_ignores=[]), 'python_script.py', 'exec'), scope)

class ReviewTests(unittest.TestCase):
    def fixture(self, flags=()):
        return {'decision': 'rejected' if flags else 'approved', 'safe_for_general_audiences': not flags,
                'categories': {c: 'violation' if c in flags else 'clear' for c in scope['COMMUNITY_STANDARDS_CATEGORIES']},
                'violations': list(flags), 'violation_details': [{'category': c, 'reason': f'Observed promotion of {c}.'} for c in flags]}

    def normalize(self, value):
        return scope['_normalize_community_standards'](value)

    def test_pass_and_educational_context(self):
        value = self.fixture(); value['categories']['illegal_drugs_or_drug_use'] = 'allowed_educational_context'
        self.assertEqual(self.normalize(value)['state'], 'passed')

    def test_multiple_flags_keep_specific_reasons_without_fabricating_evidence(self):
        value = self.fixture(('smoking_vaping_or_tobacco', 'illegal_drugs_or_drug_use'))
        value['violation_details'][0]['timestamp'] = '00:04'
        result = self.normalize(value)
        self.assertEqual(result['state'], 'flagged')
        self.assertEqual(sorted(result['violation_details'], key=lambda d: d['category']), sorted(value['violation_details'], key=lambda d: d['category']))
        unlocated = next(d for d in result['violation_details'] if d['category'] == 'illegal_drugs_or_drug_use')
        self.assertNotIn('timestamp', unlocated)
        self.assertNotIn('transcript_excerpt', unlocated)

    def test_missing_or_contradictory_output_is_not_a_violation(self):
        invalid = [None, {}, [], {'state': 'flagged'}, {'decision': 'rejected'}]
        for key, val in [('categories', {}), ('violations', ['unknown']), ('decision', 'rejected'), ('safe_for_general_audiences', False), ('violations', [{}])]:
            v = self.fixture(); v[key] = val; invalid.append(v)
        v = self.fixture(('smoking_vaping_or_tobacco',)); v['violation_details'] = []; invalid.append(v)
        for value in invalid:
            with self.subTest(value=value):
                result = self.normalize(value)
                self.assertEqual(result['state'], 'review_failed')
                self.assertEqual(result['violations'], [])

    def test_empty_and_malformed_json_raise(self):
        for text in ['', 'not JSON', '{broken}', '[]']:
            with self.assertRaises((ValueError, json.JSONDecodeError)):
                scope['_parse_json_object'](text)

    def run_video(self, responses, **kwargs):
        calls = []
        def generate(**request):
            calls.append(request)
            item = responses.pop(0)
            if isinstance(item, Exception): raise item
            return item
        scope['client'] = NS(models=NS(generate_content=generate))
        with tempfile.NamedTemporaryFile(suffix='.mp4') as file:
            file.write(b'fake video'); file.flush()
            result = scope['transcribe_and_translate_audio'](file.name, **kwargs)
        return result, calls

    def response(self, value):
        return NS(text=json.dumps(value), candidates=[], prompt_feedback=None)

    def test_review_only_never_runs_effectiveness_for_flags(self):
        value = self.fixture(('smoking_vaping_or_tobacco',))
        result, calls = self.run_video([self.response(value)], review_only=True)
        self.assertEqual(result['community_standards']['state'], 'flagged')
        self.assertEqual(len(calls), 1)
        self.assertNotIn('summary', result)

    def test_resume_uses_recorded_review_and_ignores_analysis_rewrite(self):
        review = self.normalize(self.fixture(('smoking_vaping_or_tobacco',)))
        data = {'summary': {'content': 'summary'}, 'audio_analysis': {'tempo': 100}, 'speech_clarity': {'score': 80},
                'emotion_analysis': {'happy': 1}, 'community_standards': self.fixture()}
        result, calls = self.run_video([self.response(data)], recorded_review=review)
        self.assertEqual(len(calls), 1)
        self.assertNotIn('MANDATORY APPROVAL GATE', calls[0]['contents'][1])
        self.assertNotIn('community_standards', calls[0]['contents'][1])
        self.assertEqual(result['community_standards'], review)

    def test_provider_refusal_remains_a_limitation_in_review_and_analysis(self):
        refusal = NS(text=None, candidates=[NS(finish_reason='SAFETY')], prompt_feedback=None)
        for kwargs in [{'review_only': True}, {'recorded_review': self.normalize(self.fixture())}]:
            with self.assertRaisesRegex(RuntimeError, 'provider declined'):
                self.run_video([refusal], **kwargs)

    def test_api_failure_does_not_create_confirmed_flags(self):
        with self.assertRaisesRegex(RuntimeError, 'API unavailable'):
            self.run_video([RuntimeError('API unavailable')], review_only=True)

    def test_incomplete_analysis_is_retryable(self):
        with self.assertRaisesRegex(RuntimeError, 'incomplete'):
            self.run_video([self.response({})], recorded_review=self.normalize(self.fixture()))

if __name__ == '__main__':
    unittest.main()
