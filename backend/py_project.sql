-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Mar 11, 2026 at 08:21 AM
-- Server version: 10.4.28-MariaDB
-- PHP Version: 8.0.28

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `py_project`
--

-- --------------------------------------------------------

--
-- Table structure for table `saved_videos`
--

CREATE TABLE `saved_videos` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `video_path` varchar(512) DEFAULT NULL COMMENT 'File path or URL of the uploaded video',
  `summary` text DEFAULT NULL COMMENT 'AI-generated text summary',
  `analysis` longtext DEFAULT NULL COMMENT 'Full analysis result as JSON string',
  `extra_results` text DEFAULT NULL COMMENT 'Extracted insights (tone, audience, stats) as JSON',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `file_size` bigint(20) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Stores video analysis results saved by users';

--
-- Dumping data for table `saved_videos`
--

INSERT INTO `saved_videos` (`id`, `user_id`, `video_path`, `summary`, `analysis`, `extra_results`, `created_at`, `file_size`) VALUES
(10, 2, 'uploads/1773209754400-video.mp4', 'The core message is to encourage Australians to pay more attention to their lung health due to its widespread impact. The content promotes awareness of the prevalence of poor lung health and directs listeners to a specific website for more information or action. It\'s essentially a public health awareness campaign promoting a specific organization.', '{\"transcript\":\" There\'s a part of your body you really should pay more attention to. It\'s your lungs. That\'s because poor lung health affects at least one in four Australians. Men, women, the young and old. So take a minute to check in with your lungs. Visit lungfoundation.com.au Visit lungfoundation.com.au\",\"translated_transcript\":\"There\'s a part of your body you really should pay more attention to. It\'s your lungs. That\'s because poor lung health affects at least one in four Australians. Men, women, the young and old. So take a minute to check in with your lungs. Visit lungfoundation.com.au Visit lungfoundation.com.au\",\"audio_analysis\":{\"avg_pitch_hz\":92.06,\"pitch_variability\":94.4,\"avg_energy_db\":-12.7,\"energy_variability\":14.86,\"tempo_bpm\":93.96,\"spectral_centroid_hz\":2322.7,\"zero_crossing_rate\":0.04444,\"silence_ratio\":0.051,\"estimated_speaking_rate_wpm\":80.7,\"inferred_tone\":\"energetic\"},\"emotion_analysis\":{\"happy\":0.2306,\"neutral\":0.3056,\"angry\":0.0745,\"sad\":0.0918,\"nervous\":0.2975,\"dominant_emotion\":\"neutral\"},\"speech_clarity\":{\"overall_score\":73,\"speech_pace_wpm\":96,\"pace_rating\":\"Too Slow\",\"filler_words\":1,\"tone_stability\":56,\"audio_quality\":76},\"summary\":{\"transcript\":{\"title\":\"Transcript\",\"content\":\"There\'s a part of your body you really should pay more attention to. It\'s your lungs. That\'s because poor lung health affects at least one in four Australians. Men, women, the young and old. So take a minute to check in with your lungs. Visit lungfoundation.com.au Visit lungfoundation.com.au\"},\"summary\":{\"title\":\"Summary\",\"content\":\"The core message is to encourage Australians to pay more attention to their lung health due to its widespread impact. The content promotes awareness of the prevalence of poor lung health and directs listeners to a specific website for more information or action. It\'s essentially a public health awareness campaign promoting a specific organization.\"},\"impact\":{\"title\":\"Impact on Audience\",\"content\":\"The content aims to create a sense of personal relevance and potential concern by highlighting that poor lung health affects a significant portion of the population, \'at least one in four Australians,\' and specifying that it impacts \'Men, women, the young and old.\' This broad scope is intended to make the listener feel personally vulnerable or concerned, prompting them to \'take a minute to check in with your lungs.\' The emotional impact is likely to be a mild sense of unease or a call to mindfulness regarding a bodily function they might otherwise overlook.\"},\"advertisement_effectiveness\":{\"title\":\"Advertisement Effectiveness\",\"content\":\"The message has a clear value proposition: improved personal health and awareness. The primary value is information and a prompt for self-assessment. The call-to-action is explicit and repeated: \'Visit lungfoundation.com.au.\' The language is direct and uses relatable phrasing like \'pay more attention to.\' It\'s persuasive by establishing a broad problem (\'at least one in four Australians\') and offering a simple solution (visit the website). The repetition of the website is a strong retention tactic. Its effectiveness lies in its brevity and clarity, making it memorable and actionable for the target audience.\"},\"audio_appeal\":{\"title\":\"Audio Appeal\",\"content\":\"The transcript\'s language is direct and uses short, declarative sentences, which would likely contribute to an energetic and easily digestible delivery. Phrases like \'There\'s a part of your body you really should pay more attention to\' have a conversational rhythm. The repetition of the website address is designed to be heard clearly and remembered, fitting with a slightly more deliberate pace for that specific element. The estimated speaking rate of 80.7 WPM and tempo of 93.96 BPM suggest a measured but not overly slow delivery, which, combined with the energetic inferred tone, would make the message accessible and engaging without being rushed. The low silence ratio indicates a continuous flow, reinforcing the directness.\"},\"emotional_tone\":{\"title\":\"Emotional Tone\",\"content\":\"The emotional tone is primarily one of concerned awareness or a gentle call to action. Phrases like \'you really should pay more attention to\' and highlighting the statistic \'at least one in four Australians\' suggest a serious matter. However, it\'s not alarmist. The tone is more informative and guiding, aiming to prompt a proactive check-in rather than instill panic. It\'s a tone that balances the gravity of the health issue with a practical, actionable step, making it encouraging rather than discouraging.\"},\"overall_assessment\":{\"title\":\"Overall Assessment\",\"content\":\"Strengths: The content is highly effective in its conciseness and clarity. It quickly establishes a problem, quantifies its scope, and provides a direct, actionable solution. The repetition of the website is a key strength for memorability. The language is accessible and relatable. Weaknesses: The content could potentially benefit from a slightly more engaging opening hook beyond stating a factual premise. While effective, the directness might not capture immediate attention for everyone without a more evocative emotional appeal upfront. However, for a short awareness spot, its directness is also a strength.\"},\"listener_emotions\":{\"title\":\"Listener Emotions\",\"content\":{\"Happy\":\"5%\",\"Sad\":\"15%\",\"Excited\":\"10%\",\"Neutral\":\"70%\"},\"reason\":{\"Happy\":\"Minimal happiness, perhaps a slight sense of satisfaction for being informed or taking action.\",\"Sad\":\"A moderate level of concern or sadness stemming from the statistic about poor lung health affecting many people.\",\"Excited\":\"A small percentage for those who might be motivated to actively seek health information or make a change.\",\"Neutral\":\"The majority are likely to feel neutral, as the message is primarily informational, prompting a thoughtful check-in rather than an immediate, strong emotional reaction. It\'s a call to awareness and a website visit.\"}}}}', '{\"tone\":\"energetic\",\"speaking_rate\":80.7,\"audience_emotion\":null}', '2026-03-11 14:20:23', 1726834);

-- --------------------------------------------------------

--
-- Table structure for table `tbl_account`
--

CREATE TABLE `tbl_account` (
  `acc_id` int(11) NOT NULL,
  `acc_email` varchar(255) NOT NULL,
  `acc_password` varchar(255) NOT NULL,
  `refresh_token` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_account`
--

INSERT INTO `tbl_account` (`acc_id`, `acc_email`, `acc_password`, `refresh_token`) VALUES
(2, 'testing@gmail.com', '$2a$10$6dt9mvf/NYHGYEBHtDLWKuBn401pNiQFOyxSefuB7kNjXh5Q4wXqa', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NfaWQiOjIsImlhdCI6MTc3MzIwOTczNSwiZXhwIjoxNzczODE0NTM1fQ.AOiUe_J_cBtPXRSKz3AmiXdAvMRGe8duXZwnKt_8wcQ');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `saved_videos`
--
ALTER TABLE `saved_videos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `tbl_account`
--
ALTER TABLE `tbl_account`
  ADD PRIMARY KEY (`acc_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `saved_videos`
--
ALTER TABLE `saved_videos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `tbl_account`
--
ALTER TABLE `tbl_account`
  MODIFY `acc_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `saved_videos`
--
ALTER TABLE `saved_videos`
  ADD CONSTRAINT `fk_saved_videos_account` FOREIGN KEY (`user_id`) REFERENCES `tbl_account` (`acc_id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
