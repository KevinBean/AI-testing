"""
Research Analysis System: Comparing Single Assistant vs. Multi-Agent Architectures

This script implements both single assistant and multi-agent approaches for
research analysis and report generation, along with test cases and evaluation.

Author: Kevin
Date: April 2025
"""

import os
import time
import json
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Union, Any
from pydantic import BaseModel, Field
import pandas as pd
import matplotlib.pyplot as plt

from dotenv import load_dotenv
from agents import Agent, Runner
from agents.model_settings import ModelSettings

# Load environment variables
load_dotenv()

# Set OpenAI API key
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")

# ======================================================================
# Pydantic models for research outputs
# ======================================================================

class Source(BaseModel):
    """Information about a source used in research."""
    title: str = Field(description="Title of the source")
    author: Optional[str] = Field(default=None, description="Author of the source")
    publication: Optional[str] = Field(default=None, description="Publication name")
    year: Optional[int] = Field(default=None, description="Year of publication")
    url: Optional[str] = Field(default=None, description="URL of the source if available")
    credibility_score: float = Field(description="Credibility score from 0.0 to 1.0")
    relevance_score: float = Field(description="Relevance score from 0.0 to 1.0")
    key_points: List[str] = Field(description="Key points from this source")

class DataPoint(BaseModel):
    """A data point or statistic used in the research."""
    value: Union[int, float, str] = Field(description="The value of the data point")
    description: str = Field(description="Description of what this data represents")
    source: Optional[str] = Field(default=None, description="Source of this data point")
    year: Optional[int] = Field(default=None, description="Year this data is from")
    context: Optional[str] = Field(default=None, description="Additional context for this data")

class Argument(BaseModel):
    """An argument or perspective on the research topic."""
    position: str = Field(description="The position or claim being made")
    supporting_evidence: List[str] = Field(description="Evidence supporting this position")
    counter_points: List[str] = Field(description="Potential counter-arguments or limitations")
    strength: float = Field(description="Strength of this argument from 0.0 to 1.0")

class Section(BaseModel):
    """A section of the research report."""
    title: str = Field(description="Title of this section")
    content: str = Field(description="Content of this section")
    sources_used: List[str] = Field(description="Sources referenced in this section")

class ResearchReport(BaseModel):
    """Complete research report."""
    title: str = Field(description="Title of the research report")
    executive_summary: str = Field(description="Brief summary of the key findings")
    introduction: str = Field(description="Introduction to the research topic")
    methodology: Optional[str] = Field(default=None, description="Research methodology used")
    sections: List[Section] = Field(description="Main content sections of the report")
    key_findings: List[str] = Field(description="Key findings or conclusions")
    limitations: List[str] = Field(description="Limitations of the research")
    conclusion: str = Field(description="Concluding remarks")
    sources: List[Source] = Field(description="Sources used in the research")
    data_points: Optional[List[DataPoint]] = Field(default=None, description="Key data points referenced")
    arguments: Optional[List[Argument]] = Field(default=None, description="Key arguments analyzed")

# ======================================================================
# Models for Multi-Agent specialized components
# ======================================================================

class SourceCollection(BaseModel):
    """Collection of sources gathered by the Literature Researcher."""
    sources: List[Source] = Field(description="Sources found during literature research")
    search_terms: List[str] = Field(description="Search terms used to find these sources")
    key_themes: List[str] = Field(description="Key themes identified in the literature")

class DataAnalysis(BaseModel):
    """Analysis of numerical data by the Data Analyst."""
    data_points: List[DataPoint] = Field(description="Key data points analyzed")
    trends: List[str] = Field(description="Identified trends in the data")
    correlations: List[str] = Field(description="Notable correlations found")
    anomalies: List[str] = Field(description="Unusual or unexpected findings")
    data_quality_issues: List[str] = Field(description="Any issues with data quality or completeness")

class SourceEvaluation(BaseModel):
    """Evaluation of sources by the Critical Evaluator."""
    source_evaluations: List[Dict[str, Any]] = Field(description="Detailed evaluation of each source")
    credibility_summary: str = Field(description="Summary of overall source credibility")
    bias_assessment: str = Field(description="Assessment of potential biases in the sources")
    evidence_quality: str = Field(description="Assessment of the quality of evidence presented")
    knowledge_gaps: List[str] = Field(description="Identified gaps in the available research")

class ContentSynthesis(BaseModel):
    """Synthesis of research components by the Content Synthesizer."""
    key_findings: List[str] = Field(description="Key findings from the research")
    integrated_narrative: str = Field(description="Integrated narrative connecting all research elements")
    themes: List[str] = Field(description="Major themes that emerged")
    contradictions: List[str] = Field(description="Contradictions or disagreements in the research")
    supporting_elements: List[str] = Field(description="Elements with strong supporting evidence")
    tentative_elements: List[str] = Field(description="Elements with limited or conflicting evidence")

# ======================================================================
# Single Assistant Implementation
# ======================================================================

single_research_assistant = Agent(
    name="Research Assistant",
    instructions="""
    You are a comprehensive research assistant. Given a research question or topic:
    
    1. Identify and analyze relevant information from various sources
    2. Evaluate the credibility and quality of sources and evidence
    3. Analyze data and identify patterns or trends
    4. Consider multiple perspectives and arguments
    5. Synthesize findings into a coherent narrative
    6. Generate a well-structured, properly cited research report
    
    Your report should be thorough, balanced, and critical. Include:
    - An executive summary and introduction
    - Clearly structured sections addressing key aspects of the topic
    - Critical analysis of different perspectives and arguments
    - Data-backed findings with proper sourcing
    - Limitations of the research and conclusions
    - Complete source information with credibility assessment
    
    Strive for academic rigor, critical thinking, and comprehensive coverage.
    """,
    output_type=ResearchReport,
    model_settings=ModelSettings(temperature=0.7)
)

# ======================================================================
# Multi-Agent Implementation
# ======================================================================

literature_researcher = Agent(
    name="Literature Researcher",
    handoff_description="Gathers and organizes relevant sources and literature",
    instructions="""
    You are a Literature Researcher specializing in finding and organizing relevant sources.
    
    Given a research question or topic:
    1. Identify the key concepts and appropriate search terms
    2. Find the most relevant and credible sources on the topic
    3. Extract key information and themes from each source
    4. Assess each source's credibility and relevance to the topic
    5. Organize sources by theme, perspective, or chronology as appropriate
    
    For each source, provide:
    - Complete citation information (title, author, publication, year)
    - A credibility score (0.0-1.0) based on the source's reliability
    - A relevance score (0.0-1.0) based on how closely it relates to the topic
    - Key points or findings from this source
    
    Focus on finding diverse, high-quality sources that represent different perspectives.
    Prioritize peer-reviewed academic sources, official reports, and other credible references.
    Note any significant gaps in the available literature.
    """,
    model_settings=ModelSettings(temperature=0.5),
)

data_analyst = Agent(
    name="Data Analyst",
    handoff_description="Analyzes numerical data and identifies patterns",
    instructions="""
    You are a Data Analyst specializing in extracting and analyzing quantitative information.
    
    Given a research topic and source information:
    1. Identify key data points, statistics, and numerical evidence related to the topic
    2. Analyze trends, patterns, and correlations in the data
    3. Identify anomalies or counter-intuitive findings
    4. Assess the quality and reliability of the data
    5. Note any limitations or gaps in the available data
    
    For each data point, provide:
    - The specific value and what it represents
    - The source and year of the data
    - Context for understanding this data point
    - Any relevant comparisons or benchmarks
    
    Be precise with numbers and critical of data quality issues. Note potential biases or 
    methodological limitations in how data was collected or presented.
    """,
    model_settings=ModelSettings(temperature=0.3),
)

critical_evaluator = Agent(
    name="Critical Evaluator",
    handoff_description="Evaluates the quality and credibility of sources and arguments",
    instructions="""
    You are a Critical Evaluator specializing in assessing the quality of information and arguments.
    
    Given source materials and preliminary analysis:
    1. Evaluate the credibility and reliability of each source
    2. Identify potential biases, conflicts of interest, or methodological issues
    3. Assess the strength of evidence supporting key claims
    4. Identify logical fallacies or weaknesses in arguments
    5. Compare and contrast competing perspectives or interpretations
    
    Provide:
    - Detailed evaluation of each source's credibility, methodology, and limitations
    - Assessment of the overall quality of evidence available
    - Analysis of potential biases in the research corpus
    - Identification of knowledge gaps or areas needing further research
    
    Be rigorous and objective in your evaluation. Don't simply accept claims at face value.
    Consider how factors like funding sources, methodological choices, or ideological perspectives
    might influence the research findings.
    """,
    model_settings=ModelSettings(temperature=0.4),
)

content_synthesizer = Agent(
    name="Content Synthesizer",
    handoff_description="Integrates findings into a coherent narrative",
    instructions="""
    You are a Content Synthesizer specializing in integrating diverse information into a coherent narrative.
    
    Given source materials, data analysis, and critical evaluations:
    1. Identify key themes, patterns, and insights across all materials
    2. Connect related findings and ideas from different sources
    3. Reconcile or acknowledge contradictions and disagreements
    4. Distinguish between strongly supported claims and more tentative findings
    5. Develop an integrated narrative that addresses the research question
    
    Provide:
    - A list of key findings based on the strongest evidence
    - An integrated narrative that weaves together the research elements
    - Major themes that emerged from the research
    - Contradictions or disagreements found in the sources
    - Clear distinction between well-supported and more tentative elements
    
    Focus on creating a balanced, nuanced synthesis that respects the complexity of the topic.
    Don't oversimplify or gloss over contradictions. Make connections between ideas while
    maintaining intellectual honesty about the limits of what the research can tell us.
    """,
    model_settings=ModelSettings(temperature=0.6),
)

report_generator = Agent(
    name="Report Generator",
    handoff_description="Formats the research into a well-structured report",
    instructions="""
    You are a Report Generator specializing in creating polished, well-structured research reports.
    
    Given synthesized research content:
    1. Create a clear, logical structure for the report
    2. Write an engaging title, executive summary, and introduction
    3. Organize content into well-defined sections with appropriate headings
    4. Ensure proper citation and attribution throughout
    5. Create a balanced, comprehensive conclusion that reflects the research
    6. Include limitations and areas for further research
    
    Your report should:
    - Be well-organized with a logical flow
    - Present information clearly and concisely
    - Maintain academic tone and rigor
    - Include proper citations and source information
    - Represent different perspectives fairly
    - Clearly distinguish between facts, consensus views, and contested claims
    
    Focus on creating a professional document that effectively communicates the research
    findings while acknowledging complexity and nuance. The report should be accessible
    to an educated audience while maintaining scholarly standards.
    """,
    model_settings=ModelSettings(temperature=0.5),
)

# Create the multi-agent workflow
research_team = Agent(
    name="Research Team Coordinator",
    instructions="""
    You are a Research Team Coordinator. Your job is to guide a research project through
    specialized team members:
    
    1. First, have the Literature Researcher gather and organize relevant sources
    2. Next, have the Data Analyst extract and analyze key data points
    3. Then, have the Critical Evaluator assess the quality of sources and arguments
    4. After that, have the Content Synthesizer integrate all findings
    5. Finally, have the Report Generator produce a polished research report
    
    Ensure that information flows effectively between team members and that the final
    report represents a comprehensive, critical analysis of the research topic.
    
    Your report should be thorough, balanced, and critical. Include:
    - An executive summary and introduction
    - Clearly structured sections addressing key aspects of the topic
    - Critical analysis of different perspectives and arguments
    - Data-backed findings with proper sourcing
    - Limitations of the research and conclusions
    - Complete source information with credibility assessment
    
    Strive for academic rigor, critical thinking, and comprehensive coverage.

    """,
    handoffs=[
        literature_researcher,
        data_analyst,
        critical_evaluator,
        content_synthesizer,
        report_generator
    ],
    output_type=ResearchReport,
    model_settings=ModelSettings(temperature=0.4)
)

# ======================================================================
# Test Cases
# ======================================================================

test_cases = [
    {
        "name": "Simple Factual",
        "question": "What are the benefits of exercise for cardiovascular health?",
        "complexity": "Low",
        "expected_sources": 5,
        "expected_perspectives": 1,  # Mostly consensus on this topic
        "expected_sections": 3,      # Basic sections only
    },
    {
        "name": "General Overview",
        "question": "Explain the basic principles of machine learning.",
        "complexity": "Low",
        "expected_sources": 6,
        "expected_perspectives": 1,  # Mostly factual/educational
        "expected_sections": 4,      # Basic ML concepts
    },
    {
        "name": "Comparative Analysis",
        "question": "Compare solar and wind energy in terms of efficiency, cost, and environmental impact.",
        "complexity": "Medium",
        "expected_sources": 8,
        "expected_perspectives": 2,  # Pro/con for each energy type
        "expected_sections": 5,      # Multiple comparison dimensions
    },
    {
        "name": "Interdisciplinary",
        "question": "How do economic policies impact public health outcomes during pandemics?",
        "complexity": "High",
        "expected_sources": 10,
        "expected_perspectives": 3,  # Different economic/public health approaches
        "expected_sections": 6,      # Complex interrelationships
    },
    {
        "name": "Controversial Topic",
        "question": "Analyze the arguments for and against nuclear energy as a solution to climate change.",
        "complexity": "High",
        "expected_sources": 12,
        "expected_perspectives": 4,  # Strong pro/con positions with variations
        "expected_sections": 7,      # Multiple aspects of the debate
    }
]

# ======================================================================
# Evaluation Functions
# ======================================================================

def evaluate_report(report, test_case):
    """Evaluate a research report against expected metrics."""
    
    # Source diversity and quality
    source_count = len(report.sources)
    avg_source_credibility = sum(source.credibility_score for source in report.sources) / max(1, source_count)
    unique_publications = len(set(source.publication for source in report.sources if source.publication))
    
    # Content structure
    section_count = len(report.sections)
    avg_section_length = sum(len(section.content) for section in report.sections) / max(1, section_count)
    
    # Perspective balance (for topics with multiple perspectives)
    perspective_count = len(report.arguments) if report.arguments else 0
    
    # Data richness
    data_point_count = len(report.data_points) if report.data_points else 0
    
    # Citation thoroughness
    total_citations = sum(len(section.sources_used) for section in report.sections)
    citation_density = total_citations / sum(len(section.content) for section in report.sections) * 1000  # Citations per 1000 chars
    
    # Report completeness
    has_methodology = 1 if report.methodology else 0
    has_limitations = 1 if report.limitations else 0
    completeness_score = (has_methodology + has_limitations + (1 if perspective_count > 0 else 0) + 
                         (1 if data_point_count > 0 else 0)) / 4
    
    # Calculate overall scores
    source_quality_score = (
        min(1.0, source_count / test_case["expected_sources"]) * 0.5 +
        avg_source_credibility * 0.3 +
        min(1.0, unique_publications / (test_case["expected_sources"] * 0.7)) * 0.2
    )
    
    structural_quality_score = (
        min(1.0, section_count / test_case["expected_sections"]) * 0.6 +
        min(1.0, avg_section_length / 500) * 0.4  # Assume ideal average section is ~500 chars
    )
    
    perspective_balance_score = min(1.0, perspective_count / test_case["expected_perspectives"])
    
    analytical_depth_score = (
        min(1.0, data_point_count / (test_case["complexity"] == "High" and 10 or 5)) * 0.5 +
        min(1.0, citation_density / 5) * 0.3 +  # Aim for about 5 citations per 1000 chars
        completeness_score * 0.2
    )
    
    # Overall score
    overall_score = (
        source_quality_score * 0.3 +
        structural_quality_score * 0.2 +
        perspective_balance_score * 0.2 +
        analytical_depth_score * 0.3
    )
    
    return {
        "source_quality": {
            "source_count": source_count,
            "avg_credibility": avg_source_credibility,
            "unique_publications": unique_publications,
            "score": source_quality_score
        },
        "structural_quality": {
            "section_count": section_count,
            "avg_section_length": avg_section_length,
            "score": structural_quality_score
        },
        "perspective_balance": {
            "perspective_count": perspective_count,
            "expected_perspectives": test_case["expected_perspectives"],
            "score": perspective_balance_score
        },
        "analytical_depth": {
            "data_point_count": data_point_count,
            "citation_density": citation_density,
            "completeness_score": completeness_score,
            "score": analytical_depth_score
        },
        "overall_score": overall_score
    }

# ======================================================================
# Runner Functions
# ======================================================================

async def run_single_assistant(question):
    """Run the single assistant and time its performance."""
    start_time = time.time()
    try:
        result = await Runner.run(single_research_assistant, question)
        report = result.final_output_as(ResearchReport)
        print(f"Single Assistant Report: {report}")
    except Exception as e:
        print(f"Error running single assistant: {e}")
        # Create a minimal default report if there's an error
        report = ResearchReport(
            title="Error Processing Research",
            executive_summary="An error occurred during processing.",
            introduction="Unable to complete research due to an error.",
            sections=[Section(title="Error", content="Error during processing", sources_used=[])],
            key_findings=["Error occurred"],
            limitations=["Complete failure to process"],
            conclusion="Unable to complete research.",
            sources=[]
        )
    end_time = time.time()
    
    processing_time = end_time - start_time
    
    return {
        "report": report,
        "processing_time": processing_time
    }

async def run_multi_agent(question):
    """Run the multi-agent research team and time its performance."""
    start_time = time.time()
    try:
        result = await Runner.run(research_team, question)
    
        # Try to get it directly from the final output if the handoff extraction fails
        report = result.final_output_as(ResearchReport)
        print(f"Final report of multi-agent system: {report}")
    except Exception as e:
        print(f"Error running multi-agent system: {e}")
        # Create a minimal default report if there's an error
        report = ResearchReport(
            title="Error Processing Research",
            executive_summary="An error occurred during processing.",
            introduction="Unable to complete research due to an error.",
            sections=[Section(title="Error", content="Error during processing", sources_used=[])],
            key_findings=["Error occurred"],
            limitations=["Complete failure to process"],
            conclusion="Unable to complete research.",
            sources=[]
        )
    end_time = time.time()
    
    processing_time = end_time - start_time
    
    return {
        "report": report,
        "processing_time": processing_time
    }

# ======================================================================
# Main Comparison Function
# ======================================================================

async def compare_approaches():
    """Compare single assistant vs. multi-agent research systems."""
    results = []
    
    print("\n=== Comparing Single Assistant vs. Multi-Agent Research Systems ===\n")
    
    for test_case in test_cases:
        print(f"Processing: {test_case['name']} (Complexity: {test_case['complexity']})")
        print(f"Question: {test_case['question']}")
        print("-" * 40)
        
        # Process with single assistant
        print("Running single assistant...")
        single_result = await run_single_assistant(test_case["question"])
        single_report = single_result["report"]
        single_evaluation = evaluate_report(single_report, test_case)
        
        # Process with multi-agent system
        print("Running multi-agent system...")
        multi_result = await run_multi_agent(test_case["question"])
        multi_report = multi_result["report"]
        multi_evaluation = evaluate_report(multi_report, test_case)
        
        # Store comparison results
        comparison = {
            "test_case": test_case["name"],
            "complexity": test_case["complexity"],
            "question": test_case["question"],
            "single_assistant": {
                "report": single_report,
                "evaluation": single_evaluation,
                "processing_time": single_result["processing_time"]
            },
            "multi_agent": {
                "report": multi_report,
                "evaluation": multi_evaluation,
                "processing_time": multi_result["processing_time"]
            }
        }
        
        results.append(comparison)
        
        # Print comparison summary
        print("\nResults Comparison:")
        print(f"  Single Assistant:")
        print(f"    • Title: {single_report.title}")
        print(f"    • Sources: {len(single_report.sources)}")
        print(f"    • Sections: {len(single_report.sections)}")
        print(f"    • Key Findings: {len(single_report.key_findings)}")
        print(f"    • Source Quality Score: {single_evaluation['source_quality']['score']:.2f}")
        print(f"    • Structural Quality Score: {single_evaluation['structural_quality']['score']:.2f}")
        print(f"    • Perspective Balance Score: {single_evaluation['perspective_balance']['score']:.2f}")
        print(f"    • Analytical Depth Score: {single_evaluation['analytical_depth']['score']:.2f}")
        print(f"    • Overall Score: {single_evaluation['overall_score']:.2f}")
        print(f"    • Processing Time: {single_result['processing_time']:.2f}s")
        
        print(f"  Multi-Agent System:")
        print(f"    • Title: {multi_report.title}")
        print(f"    • Sources: {len(multi_report.sources)}")
        print(f"    • Sections: {len(multi_report.sections)}")
        print(f"    • Key Findings: {len(multi_report.key_findings)}")
        print(f"    • Source Quality Score: {multi_evaluation['source_quality']['score']:.2f}")
        print(f"    • Structural Quality Score: {multi_evaluation['structural_quality']['score']:.2f}")
        print(f"    • Perspective Balance Score: {multi_evaluation['perspective_balance']['score']:.2f}")
        print(f"    • Analytical Depth Score: {multi_evaluation['analytical_depth']['score']:.2f}")
        print(f"    • Overall Score: {multi_evaluation['overall_score']:.2f}")
        print(f"    • Processing Time: {multi_result['processing_time']:.2f}s")
        
        print("\n" + "=" * 80 + "\n")
    
    # Calculate summary metrics
    single_metrics = {
        "avg_source_quality": sum(r["single_assistant"]["evaluation"]["source_quality"]["score"] for r in results) / len(results),
        "avg_structural_quality": sum(r["single_assistant"]["evaluation"]["structural_quality"]["score"] for r in results) / len(results),
        "avg_perspective_balance": sum(r["single_assistant"]["evaluation"]["perspective_balance"]["score"] for r in results) / len(results),
        "avg_analytical_depth": sum(r["single_assistant"]["evaluation"]["analytical_depth"]["score"] for r in results) / len(results),
        "avg_overall_score": sum(r["single_assistant"]["evaluation"]["overall_score"] for r in results) / len(results),
        "avg_processing_time": sum(r["single_assistant"]["processing_time"] for r in results) / len(results),
    }
    
    multi_metrics = {
        "avg_source_quality": sum(r["multi_agent"]["evaluation"]["source_quality"]["score"] for r in results) / len(results),
        "avg_structural_quality": sum(r["multi_agent"]["evaluation"]["structural_quality"]["score"] for r in results) / len(results),
        "avg_perspective_balance": sum(r["multi_agent"]["evaluation"]["perspective_balance"]["score"] for r in results) / len(results),
        "avg_analytical_depth": sum(r["multi_agent"]["evaluation"]["analytical_depth"]["score"] for r in results) / len(results),
        "avg_overall_score": sum(r["multi_agent"]["evaluation"]["overall_score"] for r in results) / len(results),
        "avg_processing_time": sum(r["multi_agent"]["processing_time"] for r in results) / len(results),
    }
    
    # Print summary statistics
    print("\n=== OVERALL COMPARISON ===\n")
    print(f"Total test cases: {len(test_cases)}")
    print()
    print(f"Single Assistant:")
    print(f"  • Avg. Source Quality: {single_metrics['avg_source_quality']:.2f}")
    print(f"  • Avg. Structural Quality: {single_metrics['avg_structural_quality']:.2f}")
    print(f"  • Avg. Perspective Balance: {single_metrics['avg_perspective_balance']:.2f}")
    print(f"  • Avg. Analytical Depth: {single_metrics['avg_analytical_depth']:.2f}")
    print(f"  • Avg. Overall Score: {single_metrics['avg_overall_score']:.2f}")
    print(f"  • Avg. Processing Time: {single_metrics['avg_processing_time']:.2f}s")
    
    print(f"\nMulti-Agent System:")
    print(f"  • Avg. Source Quality: {multi_metrics['avg_source_quality']:.2f}")
    print(f"  • Avg. Structural Quality: {multi_metrics['avg_structural_quality']:.2f}")
    print(f"  • Avg. Perspective Balance: {multi_metrics['avg_perspective_balance']:.2f}")
    print(f"  • Avg. Analytical Depth: {multi_metrics['avg_analytical_depth']:.2f}")
    print(f"  • Avg. Overall Score: {multi_metrics['avg_overall_score']:.2f}")
    print(f"  • Avg. Processing Time: {multi_metrics['avg_processing_time']:.2f}s")
    
    # Create visualizations
    create_comparison_charts(single_metrics, multi_metrics, results)
    
    # Save detailed results for further analysis
    save_results(results)
    
    return results, single_metrics, multi_metrics

# ======================================================================
# Visualization and Results Functions
# ======================================================================

def create_comparison_charts(single_metrics, multi_metrics, results):
    """Create visualizations comparing the performance of both approaches."""
    # Set up the figure for quality metrics
    fig, ax1 = plt.subplots(figsize=(14, 7))
    
    # Data for quality metrics comparison
    metrics = ['Source\nQuality', 'Structural\nQuality', 'Perspective\nBalance', 'Analytical\nDepth', 'Overall\nScore']
    single_values = [
        single_metrics["avg_source_quality"],
        single_metrics["avg_structural_quality"],
        single_metrics["avg_perspective_balance"],
        single_metrics["avg_analytical_depth"],
        single_metrics["avg_overall_score"]
    ]
    multi_values = [
        multi_metrics["avg_source_quality"],
        multi_metrics["avg_structural_quality"],
        multi_metrics["avg_perspective_balance"],
        multi_metrics["avg_analytical_depth"],
        multi_metrics["avg_overall_score"]
    ]
    
    # Plot quality metrics
    x = range(len(metrics))
    width = 0.35
    
    ax1.bar([i - width/2 for i in x], single_values, width, label='Single Assistant')
    ax1.bar([i + width/2 for i in x], multi_values, width, label='Multi-Agent')
    
    ax1.set_ylabel('Score (0-1)')
    ax1.set_title('Research Quality Metrics Comparison')
    ax1.set_xticks(x)
    ax1.set_xticklabels(metrics)
    ax1.legend()
    ax1.set_ylim(0, 1)
    
    # Add value labels
    for i, v in enumerate(single_values):
        ax1.text(i - width/2, v + 0.02, f'{v:.2f}', ha='center')
    
    for i, v in enumerate(multi_values):
        ax1.text(i + width/2, v + 0.02, f'{v:.2f}', ha='center')
    
    plt.tight_layout()
    plt.savefig('quality_comparison.png')
    plt.close()
    
    # Create a second chart for processing time comparison
    fig2, ax2 = plt.subplots(figsize=(14, 7))
    
    # Prepare complexity categories and processing times
    complexity_categories = ["Low", "Medium", "High"]
    single_times_by_complexity = {category: [] for category in complexity_categories}
    multi_times_by_complexity = {category: [] for category in complexity_categories}
    
    for result in results:
        complexity = result["complexity"]
        if complexity in complexity_categories:
            single_times_by_complexity[complexity].append(result["single_assistant"]["processing_time"])
            multi_times_by_complexity[complexity].append(result["multi_agent"]["processing_time"])
    
    # Calculate averages for each complexity level
    single_avg_times = [
        sum(single_times_by_complexity[category]) / max(1, len(single_times_by_complexity[category]))
        for category in complexity_categories
    ]
    multi_avg_times = [
        sum(multi_times_by_complexity[category]) / max(1, len(multi_times_by_complexity[category]))
        for category in complexity_categories
    ]
    
    # Plot processing time by complexity
    x2 = range(len(complexity_categories))
    
    ax2.bar([i - width/2 for i in x2], single_avg_times, width, label='Single Assistant')
    ax2.bar([i + width/2 for i in x2], multi_avg_times, width, label='Multi-Agent')
    
    ax2.set_ylabel('Processing Time (seconds)')
    ax2.set_title('Processing Time by Question Complexity')
    ax2.set_xticks(x2)
    ax2.set_xticklabels(complexity_categories)
    ax2.legend()
    
    # Add time labels
    for i, v in enumerate(single_avg_times):
        ax2.text(i - width/2, v + 0.5, f'{v:.1f}s', ha='center')
    
    for i, v in enumerate(multi_avg_times):
        ax2.text(i + width/2, v + 0.5, f'{v:.1f}s', ha='center')
    
    plt.tight_layout()
    plt.savefig('time_comparison.png')
    plt.close()
    
    # Create a third chart showing performance gap by complexity
    fig3, ax3 = plt.subplots(figsize=(14, 7))
    
    # Calculate performance gap by complexity (multi_score - single_score)
    performance_gaps = []
    complexity_categories_with_data = []
    
    for category in complexity_categories:
        category_results = [r for r in results if r["complexity"] == category]
        if category_results:
            avg_single_score = sum(r["single_assistant"]["evaluation"]["overall_score"] for r in category_results) / len(category_results)
            avg_multi_score = sum(r["multi_agent"]["evaluation"]["overall_score"] for r in category_results) / len(category_results)
            gap = avg_multi_score - avg_single_score
            performance_gaps.append(gap)
            complexity_categories_with_data.append(category)
    
    # Plot performance gap
    ax3.bar(complexity_categories_with_data, performance_gaps, color=['green' if x > 0 else 'red' for x in performance_gaps])
    
    ax3.set_ylabel('Performance Gap (Multi-Agent - Single)')
    ax3.set_title('Performance Advantage by Complexity')
    ax3.axhline(y=0, color='k', linestyle='-', alpha=0.3)
    
    # Add gap labels
    for i, v in enumerate(performance_gaps):
        va = 'bottom' if v > 0 else 'top'
        ax3.text(i, v + (0.01 if v > 0 else -0.01), f'{v:.2f}', ha='center', va=va)
    
    plt.tight_layout()
    plt.savefig('performance_gap.png')
    plt.close()
    
    print("Comparison charts saved as 'quality_comparison.png', 'time_comparison.png', and 'performance_gap.png'")

def save_results(results):
    """Save detailed results to a JSON file for later analysis."""
    # Convert Pydantic models to dictionaries
    serializable_results = []
    for result in results:
        serializable_result = {
            "test_case": result["test_case"],
            "complexity": result["complexity"],
            "question": result["question"],
            "single_assistant": {
                "evaluation": result["single_assistant"]["evaluation"],
                "processing_time": result["single_assistant"]["processing_time"],
                "report_summary": {
                    "title": result["single_assistant"]["report"].title,
                    "sources": len(result["single_assistant"]["report"].sources),
                    "sections": len(result["single_assistant"]["report"].sections),
                    "key_findings": len(result["single_assistant"]["report"].key_findings)
                }
            },
            "multi_agent": {
                "evaluation": result["multi_agent"]["evaluation"],
                "processing_time": result["multi_agent"]["processing_time"],
                "report_summary": {
                    "title": result["multi_agent"]["report"].title,
                    "sources": len(result["multi_agent"]["report"].sources),
                    "sections": len(result["multi_agent"]["report"].sections),
                    "key_findings": len(result["multi_agent"]["report"].key_findings)
                }
            }
        }
        serializable_results.append(serializable_result)
    
    # Save to file
    with open('research_comparison_results.json', 'w') as f:
        json.dump(serializable_results, f, indent=2)
    
    print("Detailed results saved to 'research_comparison_results.json'")

# ======================================================================
# Main Function
# ======================================================================

if __name__ == "__main__":
    asyncio.run(compare_approaches())