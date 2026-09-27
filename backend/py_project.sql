-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Apr 20, 2026 at 02:22 PM
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
-- Table structure for table `action_plan_tasks`
--

CREATE TABLE `action_plan_tasks` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `status` enum('To Do','In Progress','Done') NOT NULL DEFAULT 'To Do',
  `priority` enum('High','Medium','Low') NOT NULL DEFAULT 'Medium',
  `due_date` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `action_plan_tasks`
--

INSERT INTO `action_plan_tasks` (`id`, `user_id`, `title`, `status`, `priority`, `due_date`, `created_at`, `updated_at`) VALUES
(1, 2, 'asdada', 'In Progress', 'Medium', '2026-04-18', '2026-04-12 21:36:55', '2026-04-12 21:37:03');

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
(12, 2, 'uploads/1775998287212-video.mp4', 'This content delivers a direct and urgent message about the prevalence of poor lung health, stating that \'at least one in four Australians\' are affected across all demographics. The core message is to encourage proactive self-assessment of one\'s lung health, emphasizing that this is a critical aspect of overall well-being. The intended goal is to drive listeners to the Lung Foundation\'s website for further information and support, as indicated by the repeated call to action.', '{\"transcript\":\" There\'s a part of your body you really should pay more attention to. It\'s your lungs. That\'s because poor lung health affects at least one in four Australians. Men, women, the young and old. So take a minute to check in with your lungs. Visit lungfoundation.com.au Visit lungfoundation.com.au\",\"translated_transcript\":\"There\'s a part of your body you really should pay more attention to. It\'s your lungs. That\'s because poor lung health affects at least one in four Australians. Men, women, the young and old. So take a minute to check in with your lungs. Visit lungfoundation.com.au Visit lungfoundation.com.au\",\"audio_analysis\":{\"avg_pitch_hz\":88.84,\"pitch_variability\":90.67,\"avg_energy_db\":-12.7,\"energy_variability\":14.86,\"tempo_bpm\":93.96,\"spectral_centroid_hz\":2322.7,\"zero_crossing_rate\":0.04444,\"silence_ratio\":0.051,\"estimated_speaking_rate_wpm\":80.7,\"inferred_tone\":\"energetic\"},\"emotion_analysis\":{\"happy\":0.2284,\"neutral\":0.3102,\"angry\":0.0748,\"sad\":0.0946,\"nervous\":0.292,\"dominant_emotion\":\"neutral\"},\"speech_clarity\":{\"overall_score\":74,\"speech_pace_wpm\":96,\"pace_rating\":\"Too Slow\",\"filler_words\":1,\"tone_stability\":58,\"audio_quality\":76},\"summary\":{\"transcript\":{\"title\":\"Transcript\",\"content\":\"There\'s a part of your body you really should pay more attention to. It\'s your lungs. That\'s because poor lung health affects at least one in four Australians. Men, women, the young and old. So take a minute to check in with your lungs. Visit lungfoundation.com.au Visit lungfoundation.com.au\"},\"summary\":{\"title\":\"Summary\",\"content\":\"This content delivers a direct and urgent message about the prevalence of poor lung health, stating that \'at least one in four Australians\' are affected across all demographics. The core message is to encourage proactive self-assessment of one\'s lung health, emphasizing that this is a critical aspect of overall well-being. The intended goal is to drive listeners to the Lung Foundation\'s website for further information and support, as indicated by the repeated call to action.\"},\"impact\":{\"title\":\"Impact on Audience\",\"content\":\"The audience is likely to feel a sense of personal relevance and a mild sense of concern upon hearing that \'poor lung health affects at least one in four Australians.\' They will likely remember the startling statistic and the direct imperative to \'pay more attention to\' their lungs. The strong repetition of the website address makes it highly memorable, increasing the likelihood that they will act on the call to visit lungfoundation.com.au to learn more or assess their own health.\"},\"advertisement_effectiveness\":{\"title\":\"Advertisement Effectiveness\",\"content\":\"The message is clear and concise, directly identifying lungs as the body part needing attention and providing a compelling statistic for justification. The call to action, \'Visit lungfoundation.com.au,\' is repeated for emphasis, making it strong and actionable. While effective in its directness, the content could be enhanced by briefly mentioning *why* one should check their lungs or the potential consequences of ignoring lung health to further increase persuasiveness.\"},\"audio_appeal\":{\"title\":\"Audio Appeal\",\"content\":\"The energetic tone and the tempo of 93.96 BPM create a sense of urgency without being overwhelming, which effectively supports the message of prompt attention to lung health. The pitch variance of 90.67 Hz suggests a dynamic delivery that keeps the listener engaged throughout the short message. The consistent energy level (-12.7 dBFS) ensures the audio is easily discernible and maintains listener focus on the crucial information being conveyed.\"},\"emotional_tone\":{\"title\":\"Emotional Tone\",\"content\":\"The primary emotional tone conveyed is one of awareness and gentle urgency, aiming to evoke a sense of responsibility without inducing significant alarm. The initial statement, \'There\'s a part of your body you really should pay more attention to,\' sets a concerned yet helpful tone, guiding the listener towards self-reflection. The subsequent statistic aims to legitimize this concern, encouraging a pragmatic approach to health, culminating in a clear directive to seek information.\"},\"overall_assessment\":{\"title\":\"Overall Assessment\",\"content\":\"The top strengths of this content are its clarity of message and the highly memorable, repeated call to action. The statistic about \'one in four Australians\' also serves as a powerful hook. A weakness lies in its brevity, which, while effective for short spots, could benefit from a slightly more detailed explanation of the \'why\' behind checking lung health. Another area for improvement would be to add a very brief mention of what kind of information listeners can expect to find on the website, beyond just \'check in with your lungs.\' The specific actionable recommendation is to include a single, brief phrase at the end hinting at the benefit of visiting the site, such as \'Learn how to breathe easier.\'\"},\"listener_emotions\":{\"title\":\"Listener Emotions\",\"content\":{\"Happy\":\"0%\",\"Sad\":\"0%\",\"Excited\":\"15%\",\"Neutral\":\"85%\"},\"reason\":{\"Happy\":\"The content focuses on health awareness and proactive steps, which does not typically evoke happiness. It is more informational and advisory in nature.\",\"Sad\":\"While it touches upon a health concern, the tone is not designed to induce sadness. It aims for engagement and action rather than dwelling on negative outcomes.\",\"Excited\":\"The energetic tone and direct call to action might create a slight sense of anticipation or motivation to act. The urgency implied by \'pay more attention to\' could lead to a minor surge in excitement to learn more.\",\"Neutral\":\"The majority of listeners are likely to remain in a neutral emotional state, perceiving this as important public health information. The direct, factual delivery and clear instructions lend themselves to a straightforward, informational reception.\"}}}}', '{\"tone\":\"energetic\",\"speaking_rate\":80.7,\"audience_emotion\":null}', '2026-04-12 20:52:37', 1726834),
(13, 2, 'uploads/1775999095636-videoplayback.mp4', 'The core message of this content is the unveiling of the new iPhone 16 Pro, emphasizing its deep integration with \"Apple Intelligence\" for enhanced user experience and productivity. Key themes revolve around the device\'s powerful new chip (A18 Pro), advanced camera capabilities including a 5x telephoto lens and improved macro photography, and innovative software features driven by AI such as intelligent search, email summarization, and enhanced Siri understanding. The intended goal is to position the iPhone 16 Pro as the next generation of smartphones, highlighting its intelligence, power, and innovation as compelling reasons for consumers to upgrade.', '{\"transcript\":\" It\'s built for Apple Intelligence from the inside out. It has our most powerful pro chip and our most advanced camera system with an intuitive new camera control. Plus thinner borders for our largest ever display. The next generation of iPhone starts now. This is iPhone 16 Pro with Apple Intelligence. A new powerful private personal intelligence system deeply integrated into your phone and across your apps to help you get things done effortlessly. You can describe a photo you took years ago and Apple Intelligence will find it. It\'ll summarize an email thread to give you the most important information and to give Siri a richer understanding of you and what\'s on your iPhone. When the podcast Marissa, no, Justin said the other day. It can help you express yourself with the perfect Genmoji. And make whatever you\'re writing, more concise. All this and more powered by the supercharged A18 Pro with a new 16 core neural engine and a new 6 core GPU for enhanced graphics performance. It also drives the new camera control, a blend of hardware and software innovation. You can easily access your camera, change settings and take a photo. iPhone 16 Pro and Pro Max now come with a 5x telephoto camera, the longest optical zoom of any iPhone. As well as the 48 megapixel fusion camera, there\'s a 48 megapixel ultra wide camera for even higher resolution macro photography. And next gen photographic styles and you can choose a style and then personalize it to your preferred aesthetic. In a massive upgrade to Pro filmmaking, you can now shoot 4K resolution at 120 frames per second in Dolby Vision. That you can capture and edit cinematic slow motion. iPhone 16 Pro also comes equipped with studio quality mics, while Audio Max gives you more control to do things like optimize for voices. Intelligent, powerful, innovative, from the inside out. This is iPhone 16 Pro.\",\"translated_transcript\":\"It\'s built for Apple Intelligence from the inside out. It has our most powerful pro chip and our most advanced camera system with an intuitive new camera control. Plus thinner borders for our largest ever display. The next generation of iPhone starts now. This is iPhone 16 Pro with Apple Intelligence. A new powerful private personal intelligence system deeply integrated into your phone and across your apps to help you get things done effortlessly. You can describe a photo you took years ago and Apple Intelligence will find it. It\'ll summarize an email thread to give you the most important information and to give Siri a richer understanding of you and what\'s on your iPhone. When the podcast Marissa, no, Justin said the other day. It can help you express yourself with the perfect Genmoji. And make whatever you\'re writing, more concise. All this and more powered by the supercharged A18 Pro with a new 16 core neural engine and a new 6 core GPU for enhanced graphics performance. It also drives the new camera control, a blend of hardware and software innovation. You can easily access your camera, change settings and take a photo. iPhone 16 Pro and Pro Max now come with a 5x telephoto camera, the longest optical zoom of any iPhone. As well as the 48 megapixel fusion camera, there\'s a 48 megapixel ultra wide camera for even higher resolution macro photography. And next gen photographic styles and you can choose a style and then personalize it to your preferred aesthetic. In a massive upgrade to Pro filmmaking, you can now shoot 4K resolution at 120 frames per second in Dolby Vision. That you can capture and edit cinematic slow motion. iPhone 16 Pro also comes equipped with studio quality mics, while Audio Max gives you more control to do things like optimize for voices. Intelligent, powerful, innovative, from the inside out. This is iPhone 16 Pro.\",\"audio_analysis\":{\"avg_pitch_hz\":135.21,\"pitch_variability\":142.11,\"avg_energy_db\":-15.79,\"energy_variability\":15.62,\"tempo_bpm\":143.55,\"spectral_centroid_hz\":2100.38,\"zero_crossing_rate\":0.04597,\"silence_ratio\":0.063,\"estimated_speaking_rate_wpm\":56.4,\"inferred_tone\":\"expressive/calm\"},\"emotion_analysis\":{\"happy\":0.2425,\"neutral\":0.2889,\"angry\":0.0709,\"sad\":0.0545,\"nervous\":0.3432,\"dominant_emotion\":\"nervous\"},\"speech_clarity\":{\"overall_score\":75,\"speech_pace_wpm\":111,\"pace_rating\":\"Ideal\",\"filler_words\":2,\"tone_stability\":42,\"audio_quality\":78},\"summary\":{\"transcript\":{\"title\":\"Transcript\",\"content\":\"It\'s built for Apple Intelligence from the inside out. It has our most powerful pro chip and our most advanced camera system with an intuitive new camera control. Plus thinner borders for our largest ever display. The next generation of iPhone starts now. This is iPhone 16 Pro with Apple Intelligence. A new powerful private personal intelligence system deeply integrated into your phone and across your apps to help you get things done effortlessly. You can describe a photo you took years ago and Apple Intelligence will find it. It\'ll summarize an email thread to give you the most important information and to give Siri a richer understanding of you and what\'s on your iPhone. When the podcast Marissa, no, Justin said the other day. It can help you express yourself with the perfect Genmoji. And make whatever you\'re writing, more concise. All this and more powered by the supercharged A18 Pro with a new 16 core neural engine and a new 6 core GPU for enhanced graphics performance. It also drives the new camera control, a blend of hardware and software innovation. You can easily access your camera, change settings and take a photo. iPhone 16 Pro and Pro Max now come with a 5x telephoto camera, the longest optical zoom of any iPhone. As well as the 48 megapixel fusion camera, there\'s a 48 megapixel ultra wide camera for even higher resolution macro photography. And next gen photographic styles and you can choose a style and then personalize it to your preferred aesthetic. In a massive upgrade to Pro filmmaking, you can now shoot 4K resolution at 120 frames per second in Dolby Vision. That you can capture and edit cinematic slow motion. iPhone 16 Pro also comes equipped with studio quality mics, while Audio Max gives you more control to do things like optimize for voices. Intelligent, powerful, innovative, from the inside out. This is iPhone 16 Pro.\"},\"summary\":{\"title\":\"Summary\",\"content\":\"The core message of this content is the unveiling of the new iPhone 16 Pro, emphasizing its deep integration with \\\"Apple Intelligence\\\" for enhanced user experience and productivity. Key themes revolve around the device\'s powerful new chip (A18 Pro), advanced camera capabilities including a 5x telephoto lens and improved macro photography, and innovative software features driven by AI such as intelligent search, email summarization, and enhanced Siri understanding. The intended goal is to position the iPhone 16 Pro as the next generation of smartphones, highlighting its intelligence, power, and innovation as compelling reasons for consumers to upgrade.\"},\"impact\":{\"title\":\"Impact on Audience\",\"content\":\"The audience is likely to feel a sense of excitement and anticipation for the new iPhone 16 Pro, particularly due to the promise of \\\"Apple Intelligence\\\" making tasks effortless and Siri having a \\\"richer understanding.\\\" They will likely remember the specific features highlighted, such as the 5x telephoto camera, the ability to find photos by description, and the cinematic 4K 120fps recording capability. This could strongly influence their purchase decisions, leading to increased interest and potential pre-orders or a desire to learn more about the device.\"},\"advertisement_effectiveness\":{\"title\":\"Advertisement Effectiveness\",\"content\":\"The message clarity is high, with a strong focus on \\\"Apple Intelligence\\\" as the central differentiator for the iPhone 16 Pro, clearly linking it to enhanced functionality. The persuasiveness is bolstered by enumerating specific, tangible benefits like effortless task completion and advanced camera features, using phrases like \\\"get things done effortlessly\\\" and \\\"massive upgrade to Pro filmmaking.\\\" While there isn\'t a direct \\\"call to action\\\" in the traditional sense, the concluding statement \\\"The next generation of iPhone starts now\\\" serves as an implicit prompt to consider this new device as the future, encouraging contemplation and further investigation.\"},\"audio_appeal\":{\"title\":\"Audio Appeal\",\"content\":\"The audio delivery, described as expressive/calm with a moderate pitch and pitch variation, effectively conveys a sense of confidence and technological advancement without being overly aggressive. The speaking rate of 56.4 WPM is quite slow, which allows listeners ample time to process the technical information and the benefits of Apple Intelligence. The energy level, though relatively low (-15.79 dBFS), contributes to a sophisticated and premium feel, aligning well with Apple\'s brand image and the \\\"intelligent, powerful, innovative\\\" message.\"},\"emotional_tone\":{\"title\":\"Emotional Tone\",\"content\":\"The primary emotional tone conveyed is one of sophisticated excitement and technological optimism, stemming from the introduction of \\\"Apple Intelligence\\\" and its practical applications. This tone remains relatively consistent, building a sense of awe and wonder about the device\'s capabilities throughout the description. The carefully chosen vocabulary like \\\"most powerful,\\\" \\\"most advanced,\\\" and \\\"effortlessly\\\" aims to evoke feelings of aspiration and a desire for cutting-edge technology, positioning the iPhone 16 Pro as a desirable upgrade.\"},\"overall_assessment\":{\"title\":\"Overall Assessment\",\"content\":\"The top two strengths are the clear articulation of \\\"Apple Intelligence\\\" as the central innovative feature and the detailed, benefit-driven descriptions of the advanced camera system, including specific upgrades like the 5x telephoto and 4K 120fps recording. Two key weaknesses are the potentially too slow speaking rate (56.4 WPM) which might lead to listener disengagement for some, and the lack of a direct, explicit call to action, relying instead on an implicit suggestion to consider the device. An actionable recommendation would be to slightly increase the speaking rate in future iterations of this type of content and to incorporate a more direct call to action, such as \\\"Visit Apple.com to learn more\\\" or \\\"Pre-order yours today.\\\"\"},\"listener_emotions\":{\"content\":{\"Happy\":\"25%\",\"Sad\":\"0%\",\"Excited\":\"65%\",\"Neutral\":\"10%\"},\"reason\":{\"Happy\":\"The announcement of a \\\"new powerful private personal intelligence system\\\" designed to \\\"help you get things done effortlessly\\\" evokes happiness by promising increased convenience and efficiency in daily tasks. This prospect of simplifying life through technology contributes to a positive emotional response.\",\"Sad\":\"There are no elements in the transcript that evoke sadness, as the content focuses entirely on technological advancements and benefits. The tone is forward-looking and aspirational, with no mention of limitations or negative aspects.\",\"Excited\":\"The \\\"next generation of iPhone starts now\\\" and the emphasis on \\\"Apple Intelligence\\\" generate significant excitement by highlighting groundbreaking features and innovations. Phrases like \\\"most powerful pro chip,\\\" \\\"most advanced camera system,\\\" and \\\"massive upgrade to Pro filmmaking\\\" directly fuel anticipation and interest in the new product.\",\"Neutral\":\"A small percentage of neutral emotion is present, likely for listeners who are not immediately swayed by new technology or who are waiting for more detailed technical specifications beyond the marketing highlights. This segment may be processing the information in a more analytical, rather than emotionally driven, manner.\"}}}}', '{\"tone\":\"expressive/calm\",\"speaking_rate\":56.4,\"audience_emotion\":null}', '2026-04-12 21:11:20', 11348528);

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
(2, 'testing@gmail.com', '$2a$10$6dt9mvf/NYHGYEBHtDLWKuBn401pNiQFOyxSefuB7kNjXh5Q4wXqa', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2NfaWQiOjIsImlhdCI6MTc3NjUwNTEzNywiZXhwIjoxNzc3MTA5OTM3fQ.35nwD42MygBdy1p-pNBsI2kumPg8-dlvrwy5nyt_CLw');

-- --------------------------------------------------------

--
-- Table structure for table `tbl_account_details`
--

CREATE TABLE `tbl_account_details` (
  `id` int(11) NOT NULL,
  `acc_id` int(11) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `contact_number` varchar(20) NOT NULL,
  `address` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `tbl_account_details`
--

INSERT INTO `tbl_account_details` (`id`, `acc_id`, `full_name`, `contact_number`, `address`) VALUES
(1, 2, 'Test name', '09565535401', 'Test Address'),
(2, 2, 'Test name', '09565535401', 'Test Address');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `action_plan_tasks`
--
ALTER TABLE `action_plan_tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_action_tasks_user_id` (`user_id`),
  ADD KEY `idx_action_tasks_created_at` (`created_at`);

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
-- Indexes for table `tbl_account_details`
--
ALTER TABLE `tbl_account_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_id` (`acc_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `action_plan_tasks`
--
ALTER TABLE `action_plan_tasks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `saved_videos`
--
ALTER TABLE `saved_videos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `tbl_account`
--
ALTER TABLE `tbl_account`
  MODIFY `acc_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `tbl_account_details`
--
ALTER TABLE `tbl_account_details`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `action_plan_tasks`
--
ALTER TABLE `action_plan_tasks`
  ADD CONSTRAINT `fk_action_plan_tasks_account` FOREIGN KEY (`user_id`) REFERENCES `tbl_account` (`acc_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `saved_videos`
--
ALTER TABLE `saved_videos`
  ADD CONSTRAINT `fk_saved_videos_account` FOREIGN KEY (`user_id`) REFERENCES `tbl_account` (`acc_id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `tbl_account_details`
--
ALTER TABLE `tbl_account_details`
  ADD CONSTRAINT `fk_id` FOREIGN KEY (`acc_id`) REFERENCES `tbl_account` (`acc_id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
