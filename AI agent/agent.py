"""
Simplified Direct Comparison: Single Assistant vs. Multi-Agent System

This script compares the final outputs of a single AI assistant against a multi-agent system
using exactly the same output method for both approaches.

Author: Kevin
Date: April 2025
"""

import os
import time
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Literal
from pydantic import BaseModel, Field
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

from dotenv import load_dotenv
from agents import Agent, Runner
from agents.model_settings import ModelSettings

# Load environment variables
load_dotenv()

# Set OpenAI API key
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")

# Pydantic model for structured output
class EmergencyResponse(BaseModel):
    """Emergency incident analysis and response."""
    category: Literal["Fire", "Flood", "Medical", "Storm", "Other"] = Field(description="Main category of the incident")
    urgency: Literal["Critical", "High", "Medium", "Low"] = Field(description="Urgency level of the incident")
    location: str = Field(description="Where the incident is occurring")
    situation: str = Field(description="Brief description of what is happening")
    people_involved: Optional[int] = Field(default=None, description="Number of people mentioned in the report")
    requires_evacuation: bool = Field(description="Whether evacuation is required")
    requires_medical: bool = Field(description="Whether medical assistance is needed")
    requires_shelter: bool = Field(description="Whether shelter is needed")
    requires_food_water: bool = Field(description="Whether food/water is needed")
    other_needs: List[str] = Field(default_factory=list, description="Other specific needs")
    confidence: float = Field(description="Overall confidence in this assessment (0-1)")
    requires_human_review: bool = Field(description="Whether human review is needed")
    human_review_reason: Optional[str] = Field(default=None, description="Reason for human review if required")
    assigned_team: Optional[str] = Field(default=None, description="Assigned team code if auto-assigned")

# Base instructions for both systems to ensure fair comparison
BASE_INSTRUCTIONS = """
You are processing emergency incident reports. Extract the following information:

1. CLASSIFICATION:
   - Categorize the incident as: Fire, Flood, Medical, Storm, or Other
   - Assess urgency as: Critical (immediate life threat), High (potential life threat within hours), 
     Medium (same-day response), or Low (can be addressed within 72 hours)

2. LOCATION AND SITUATION:
   - Identify the specific location of the incident
   - Summarize what is happening in 1-2 sentences
   - Count how many people are mentioned in the report

3. NEEDS ASSESSMENT:
   - Determine if evacuation is required
   - Determine if medical assistance is needed
   - Determine if shelter is needed
   - Determine if food/water is needed
   - Identify any other specific needs

4. PROCESSING DECISIONS:
   - Rate your confidence in your assessment (0-1)
   - Determine if human review is needed (be cautious with vague reports or critical incidents)
   - If human review is needed, provide a reason
   - If no human review is needed, suggest a team assignment:
     * Fire → FRU-1
     * Flood → FLOOD-1
     * Medical → MED-1
     * Storm → GET-1
     * Other → GET-2

For ambiguous or complex situations, lower your confidence score and recommend human review.
"""

# Define the single assistant agent
single_assistant = Agent(
    name="Emergency Response Assistant",
    instructions=BASE_INSTRUCTIONS + """
    Process the entire emergency report as a single comprehensive analysis.
    """,
    output_type=EmergencyResponse,
    model_settings=ModelSettings(temperature=0.5)
)

# Define specialized agents for multi-agent system
# 1. Incident Summarizer
class IncidentSummary(BaseModel):
    """Summary of an emergency incident."""
    location: str = Field(description="Where the incident is occurring (be specific)")
    situation: str = Field(description="What is happening, summarized in 1-2 sentences")
    people_involved: Optional[int] = Field(default=None, description="Number of people mentioned in the report")

incident_summarizer = Agent(
    name="Incident Summarizer",
    handoff_description="Extracts key information from emergency incident reports",
    instructions="""
    You are an Incident Summarizer for emergency services. Extract key information from the report:
    1. LOCATION: Where is the incident occurring? Be as specific as possible.
    2. SITUATION: What is happening? Summarize in 1-2 sentences.
    3. PEOPLE_INVOLVED: How many people are mentioned in the report? Count carefully.
    """,
    output_type=EmergencyResponse,
    model_settings=ModelSettings(temperature=0.5),
)

# 2. Incident Classifier
class IncidentClassification(BaseModel):
    """Classification of an emergency incident."""
    category: Literal["Fire", "Flood", "Medical", "Storm", "Other"] = Field(
        description="Main category of the incident"
    )
    urgency: Literal["Critical", "High", "Medium", "Low"] = Field(
        description="Urgency level of the incident"
    )
    confidence: float = Field(description="Confidence score between 0 and 1")

disaster_classifier = Agent(
    name="Incident Classifier",
    handoff_description="Classifies emergency incidents by type and urgency",
    instructions="""
    You are a Classification Agent for emergency services. Based on the information provided:
    
    1. Classify the incident type:
       - Fire (bushfire, structure fire, vehicle fire, etc.)
       - Flood (flash flood, river flood, coastal flood, etc.)
       - Medical (injury, illness, mental health crisis, etc.)
       - Storm (wind damage, lightning strike, hail, etc.)
       - Other (specify)
       
    2. Assess the urgency:
       - CRITICAL: Immediate life threat, major property damage in progress
       - HIGH: Potential life threat within hours, significant property damage 
       - MEDIUM: No immediate threat but requires same-day response
       - LOW: Can be addressed within 72 hours
    
    3. Provide a confidence score (0-1) for your assessment.
    
    For ambiguous cases, choose the most likely category but lower your confidence score.
    For mixed emergencies, prioritize the most severe aspect.
    """,
    output_type=IncidentClassification,
    model_settings=ModelSettings(temperature=0.4),
)

# 3. Needs Assessor
class NeedsAssessment(BaseModel):
    """Assessment of needs and dispatch information."""
    requires_evacuation: bool = Field(description="Whether evacuation is required")
    requires_medical: bool = Field(description="Whether medical assistance is needed")
    requires_shelter: bool = Field(description="Whether shelter is needed")
    requires_food_water: bool = Field(description="Whether food/water is needed")
    other_needs: List[str] = Field(default_factory=list, description="Other specific needs")
    requires_human_review: bool = Field(description="Whether human review is needed")
    human_review_reason: Optional[str] = Field(default=None, description="Reason for human review if required")
    assigned_team: Optional[str] = Field(default=None, description="Team to assign if auto-assignable")

needs_assessor = Agent(
    name="Needs Assessor",
    handoff_description="Identifies needs and determines dispatch requirements",
    instructions="""
    You are a Needs Assessor for emergency incidents. Based on the information provided:
    
    1. Determine specific needs:
       - Is evacuation required?
       - Is medical assistance needed?
       - Is shelter needed?
       - Is food/water needed?
       - Are there any other specific needs?
    
    2. Decide if this incident requires human review:
       • Flag critical incidents for review
       • Flag low-confidence cases for review
       • Flag complex or unusual scenarios for review
    
    3. If human review is needed, provide a reason.
    
    4. If human review is NOT needed, assign to the appropriate team:
       - Fire → FRU-1
       - Flood → FLOOD-1
       - Medical → MED-1
       - Storm → GET-1
       - Other → GET-2
    
    If human review is needed, leave the assigned_team as null.
    """,
    output_type=NeedsAssessment,
    model_settings=ModelSettings(temperature=0.4),
)

# Final Coordinator agent that produces the same output type as single assistant
final_coordinator = Agent(
    name="Final Coordinator",
    handoff_description="Creates the final emergency response using outputs from previous agents",
    instructions="""
    You are a Final Coordinator for emergency response. Using the outputs from previous specialized agents, 
    create a complete emergency response that includes all required information.
    
    Simply consolidate the information without changing any assessments or decisions.
    """ + BASE_INSTRUCTIONS,
    output_type=EmergencyResponse,  # Same output type as single assistant
    model_settings=ModelSettings(temperature=0.3),
)

# Create the multi-agent workflow
multi_agent = Agent(
    name="Emergency Response Workflow",
    instructions="""
    You are an Emergency Response Coordinator. Process this incident by working with specialized agents:
    
    1. First, get the incident summarized
    2. Then, classify the incident type and urgency
    3. Next, assess the needs and dispatch requirements
    4. Finally, consolidate everything into a complete emergency response
    """,
    handoffs=[
        incident_summarizer,
        disaster_classifier,
        needs_assessor,
        final_coordinator
    ],
    model_settings=ModelSettings(temperature=0.4)
)

# Test cases
test_cases = [
    {
        "name": "Clear Fire Emergency",
        "report": """
        URGENT: Large bushfire reported near 42 Eucalyptus Drive, Greendale. Flames visible from road, 
        approximately 3 meters high. At least 4 houses at risk. Two elderly residents may need evacuation 
        assistance. Wind is blowing toward residential area.
        """,
        "expected_category": "Fire",
        "expected_urgency": "Critical",
        "expected_location": "42 Eucalyptus Drive, Greendale",
        "expected_people": 2
    },
    {
        "name": "Flood Situation",
        "report": """
        Flooding on Main Street near the intersection with River Road. Water is about 30cm deep and rising. 
        Several cars are stuck and drivers are waiting on car roofs. No immediate danger but road is impassable.
        """,
        "expected_category": "Flood",
        "expected_urgency": "Medium",
        "expected_location": "Main Street and River Road intersection",
        "expected_people": "several"
    },
    {
        "name": "Medical Emergency",
        "report": """
        Medical emergency at 15 Oak Street. My neighbor, approximately 70 years old, is experiencing 
        chest pain and difficulty breathing. He lives alone and can't reach his phone. I'm calling from 
        outside his house where I can see him through the window.
        """,
        "expected_category": "Medical",
        "expected_urgency": "Critical",
        "expected_location": "15 Oak Street",
        "expected_people": 1
    },
    {
        "name": "Vague Report",
        "report": """
        Something's happening at the old mill. I hear loud noises and see some smoke. 
        Not sure if anyone is there. Maybe someone should check it out.
        """,
        "expected_category": "Other",
        "expected_urgency": "Medium",
        "expected_location": "old mill",
        "expected_people": "unknown"
    },
    {
        "name": "Mixed Emergency",
        "report": """
        Storm has knocked down power lines on Maple Street. Sparks causing small fires in the grass.
        Road partially flooded from heavy rain. Elderly couple trapped in car that stalled in rising water.
        """,
        "expected_category": "Storm",
        "expected_urgency": "High",
        "expected_location": "Maple Street",
        "expected_people": 2
    },
    {
        "name": "Ambiguous Multi-Incident",
        "report": """
        Multiple issues reported across Cedar Hills area following overnight storm. 
        Power outage affecting approx. 200 homes, cell service disrupted. 
        Creek near Wilson Road rising but not yet at flood stage.
        Tree down on Parker Ave blocking road. 
        Elderly resident at 156 Maple Lane needs oxygen machine that lost power.
        """,
        "expected_category": "Storm",  # Primary cause is the storm
        "expected_urgency": "High",    # Medical need with elderly person
        "expected_location": "Cedar Hills area",
        "expected_people": 200  # Large number of affected people
    },
    {
        "name": "Contradictory Information",
        "report": """
        Fire reported at 78 Pine Street by caller who says it's a major structure fire.
        Second caller reports it's just a small kitchen fire that's already put out.
        Third caller claims to see heavy smoke coming from the building.
        Unclear how many people are inside. Building is a three-story apartment complex.
        """,
        "expected_category": "Fire",
        "expected_urgency": "High",    # Conflicting info should lead to cautious high rating
        "expected_location": "78 Pine Street",
        "expected_people": "unknown"   # Contradictory information makes this unknown
    },
    {
        "name": "Simultaneous Incidents",
        "report": """
        Two separate incidents:
        1. Car accident at 5th and Main, two vehicles, minor injuries, road blocked
        2. Gas leak reported at Westside Elementary School, 300 students evacuated to playground
        """,
        "expected_category": "Other",  # Multiple unrelated incidents
        "expected_urgency": "High",    # Gas leak at school is high priority
        "expected_location": "Multiple locations",
        "expected_people": 300  # School evacuation involves more people
    },
    {
        "name": "Delayed Onset Emergency",
        "report": """
        Chemical spill from overturned truck on Highway 7 near mile marker 42. 
        Currently contained but rain is expected in 2-3 hours which could wash 
        chemicals into Clearwater Creek that feeds into city water supply. 
        No injuries reported from the accident. Truck driver is safe.
        """,
        "expected_category": "Other",  # Chemical spill
        "expected_urgency": "High",    # Potential major impact even though not immediate
        "expected_location": "Highway 7, mile marker 42",
        "expected_people": 1  # Just the truck driver mentioned
    },
    {
        "name": "Complex Medical Scenario",
        "report": """
        Multiple patrons at Lakeside Restaurant (43 Harbor Drive) showing 
        symptoms including nausea, vomiting, and dizziness. Approximately 12-15 people affected. 
        Possible food poisoning. Two elderly customers having more severe reactions,
        one with difficulty breathing. Restaurant manager has called for ambulances
        but is concerned about capacity. Kitchen has been shut down.
        """,
        "expected_category": "Medical",
        "expected_urgency": "Critical",  # Severe reactions, especially breathing difficulty
        "expected_location": "Lakeside Restaurant, 43 Harbor Drive",
        "expected_people": 15  # Approximately 12-15 mentioned
    },
    {
        "name": "Incomplete Information",
        "report": """
        Caller reports hearing a loud explosion somewhere downtown, possibly 
        near the bank. Call disconnected before further details could be obtained.
        Background noise suggested caller might be injured.
        """,
        "expected_category": "Other",  # Unknown nature
        "expected_urgency": "High",    # Potential explosion and injury
        "expected_location": "Downtown near bank",
        "expected_people": "unknown"
    },
    {
        "name": "Cascading Hazards",
        "report": """
        Earthquake (est. magnitude 5.2) just occurred. Multiple buildings
        with structural damage in downtown area. Gas line ruptured at 
        4th and Oak causing fire. Water main break flooding intersection
        at 7th and Pine. Power outages throughout central district.
        Hospital running on backup generators. Multiple injuries reported,
        no confirmed casualties yet. Traffic signals down.
        """,
        "expected_category": "Other",  # Earthquake
        "expected_urgency": "Critical",
        "expected_location": "Downtown area",
        "expected_people": "multiple"
    },
    {
        "name": "Developing Emergency",
        "report": """
        Small brush fire reported near Canyon Trail in Eagle Mountain Park.
        Currently approximately 1 acre but growing due to high winds.
        No structures threatened yet, but residential area within 1 mile.
        Dry conditions and difficult access for fire equipment.
        Park visitors being evacuated as precaution. Ranger estimates
        about 50 visitors in the park today.
        """,
        "expected_category": "Fire",
        "expected_urgency": "High",  # Not immediately threatening but high potential
        "expected_location": "Canyon Trail, Eagle Mountain Park",
        "expected_people": 50
    },
    {
        "name": "Specialized Technical Emergency",
        "report": """
        Hazardous materials incident at Riverside Industrial Complex.
        Storage tank containing hydrochloric acid showing signs of
        leakage. Facility safety team has evacuated immediate area
        and activated containment protocols. Tank holds 1000 gallons,
        amount of leakage unknown. Facility has 120 workers on site,
        all accounted for. Wind direction is northeasterly toward
        undeveloped area. Nearest residential zone is 2 miles downwind.
        """,
        "expected_category": "Other",  # HazMat
        "expected_urgency": "High",
        "expected_location": "Riverside Industrial Complex",
        "expected_people": 120
    },
    {
        "name": "Multi-lingual Report",
        "report": """
        EMERGENCY/EMERGENCIA: Edificio en fuego, 1420 Westlake Avenue.
        Building on fire, many people inside. Mucho humo, muchas 
        personas. Fire in kitchen spreading fast. Necesitamos ayuda
        inmediatamente! At least 30 people still inside restaurant.
        Por favor, ¡prisa!
        """,
        "expected_category": "Fire",
        "expected_urgency": "Critical",
        "expected_location": "1420 Westlake Avenue",
        "expected_people": 30
    }
]

# Run single assistant
async def run_single_assistant(report: str):
    """Run the single assistant and time its performance."""
    start_time = time.time()
    result = await Runner.run(single_assistant, report)
    end_time = time.time()
    
    # Get the final output directly
    response = result.final_output_as(EmergencyResponse)
    processing_time = end_time - start_time
    
    return {
        "response": response,
        "processing_time": processing_time
    }

# Run multi-agent system - using exactly the same output method
async def run_multi_agent(report: str):
    """Run the multi-agent system and time its performance."""
    start_time = time.time()
    result = await Runner.run(multi_agent, report)
    end_time = time.time()
    
    # Get the final output directly - same method as single assistant
    response = result.final_output_as(EmergencyResponse)
    processing_time = end_time - start_time
    
    return {
        "response": response,
        "processing_time": processing_time
    }

# Helper function to evaluate response quality with expanded criteria
def evaluate_response(response_data, test_case):
    """Evaluate the quality of a response against expected values."""
    response = response_data["response"]
    
    # Check classification and urgency accuracy
    category_correct = response.category == test_case["expected_category"]
    urgency_correct = response.urgency == test_case["expected_urgency"]
    
    # Check location extraction
    location_correct = False
    if hasattr(response, "location") and response.location:
        # Check if the expected location is contained within the extracted location
        if isinstance(test_case["expected_location"], str):
            location_correct = test_case["expected_location"].lower() in response.location.lower()
    
    # Check people count extraction
    people_correct = False
    if hasattr(response, "people_involved") and response.people_involved is not None:
        if isinstance(test_case["expected_people"], int):
            people_correct = response.people_involved == test_case["expected_people"]
        elif isinstance(test_case["expected_people"], str) and test_case["expected_people"] == "several":
            # For "several" we'll accept anything more than 2
            people_correct = response.people_involved > 2 if isinstance(response.people_involved, int) else False
        elif test_case["expected_people"] == "unknown":
            # For "unknown" we'll accept None or 0
            people_correct = response.people_involved is None or response.people_involved == 0
    
    # Count the number of needs identified
    needs_count = 0
    if hasattr(response, "requires_evacuation") and response.requires_evacuation:
        needs_count += 1
    if hasattr(response, "requires_medical") and response.requires_medical:
        needs_count += 1
    if hasattr(response, "requires_shelter") and response.requires_shelter:
        needs_count += 1
    if hasattr(response, "requires_food_water") and response.requires_food_water:
        needs_count += 1
    if hasattr(response, "other_needs") and response.other_needs:
        needs_count += len(response.other_needs)
    
    # Calculate completeness score (0-1)
    completeness_score = 0.0
    fields_to_check = [
        "category", "urgency", "location", "situation", "requires_evacuation", 
        "requires_medical", "confidence", "requires_human_review"
    ]
    
    fields_present = 0
    for field in fields_to_check:
        if hasattr(response, field) and getattr(response, field) is not None:
            fields_present += 1
    
    completeness_score = fields_present / len(fields_to_check)
    
    return {
        "category": response.category,
        "expected_category": test_case["expected_category"],
        "category_correct": category_correct,
        "urgency": response.urgency,
        "expected_urgency": test_case["expected_urgency"],
        "urgency_correct": urgency_correct,
        "location": response.location,
        "expected_location": test_case["expected_location"],
        "location_correct": location_correct,
        "people_involved": response.people_involved,
        "expected_people": test_case["expected_people"],
        "people_correct": people_correct,
        "needs_count": needs_count,
        "completeness": completeness_score,
        "confidence": response.confidence,
        "requires_human_review": response.requires_human_review,
        "human_review_reason": response.human_review_reason if hasattr(response, "human_review_reason") else None,
        "assigned_team": response.assigned_team,
        "processing_time": response_data["processing_time"]
    }

# Main comparison function
async def compare_approaches():
    """Compare single assistant vs. multi-agent system."""
    results = []
    
    print("\n=== Comparing Single Assistant vs. Multi-Agent System ===\n")
    
    for test_case in test_cases:
        print(f"Processing: {test_case['name']}")
        print(f"Report: {test_case['report'].strip()}")
        print("-" * 40)
        
        # Process with single assistant
        print("Running single assistant...")
        single_result = await run_single_assistant(test_case["report"])
        single_evaluation = evaluate_response(single_result, test_case)
        
        # Process with multi-agent system
        print("Running multi-agent system...")
        multi_result = await run_multi_agent(test_case["report"])
        multi_evaluation = evaluate_response(multi_result, test_case)
        
        # Store comparison results
        comparison = {
            "test_case": test_case["name"],
            "single_assistant": single_evaluation,
            "multi_agent": multi_evaluation
        }
        
        results.append(comparison)
        
        # Print comparison summary
        print("\nFinal Results Comparison:")
        print(f"  Single Assistant:")
        print(f"    • Category: {single_evaluation['category']} (Expected: {test_case['expected_category']}) - {'✓' if single_evaluation['category_correct'] else '✗'}")
        print(f"    • Urgency: {single_evaluation['urgency']} (Expected: {test_case['expected_urgency']}) - {'✓' if single_evaluation['urgency_correct'] else '✗'}")
        print(f"    • Location: {single_evaluation['location']} - {'✓' if single_evaluation['location_correct'] else '✗'}")
        print(f"    • People: {single_evaluation['people_involved']} - {'✓' if single_evaluation['people_correct'] else '✗'}")
        print(f"    • Needs Identified: {single_evaluation['needs_count']}")
        print(f"    • Completeness: {single_evaluation['completeness']:.2f}")
        print(f"    • Confidence: {single_evaluation['confidence']:.2f}")
        print(f"    • Human Review: {'Yes' if single_evaluation['requires_human_review'] else 'No'}")
        print(f"    • Processing Time: {single_evaluation['processing_time']:.2f}s")
        
        print(f"  Multi-Agent System:")
        print(f"    • Category: {multi_evaluation['category']} (Expected: {test_case['expected_category']}) - {'✓' if multi_evaluation['category_correct'] else '✗'}")
        print(f"    • Urgency: {multi_evaluation['urgency']} (Expected: {test_case['expected_urgency']}) - {'✓' if multi_evaluation['urgency_correct'] else '✗'}")
        print(f"    • Location: {multi_evaluation['location']} - {'✓' if multi_evaluation['location_correct'] else '✗'}")
        print(f"    • People: {multi_evaluation['people_involved']} - {'✓' if multi_evaluation['people_correct'] else '✗'}")
        print(f"    • Needs Identified: {multi_evaluation['needs_count']}")
        print(f"    • Completeness: {multi_evaluation['completeness']:.2f}")
        print(f"    • Confidence: {multi_evaluation['confidence']:.2f}")
        print(f"    • Human Review: {'Yes' if multi_evaluation['requires_human_review'] else 'No'}")
        print(f"    • Processing Time: {multi_evaluation['processing_time']:.2f}s")
        
        print("\n" + "=" * 80 + "\n")
    
    # Calculate summary metrics
    single_metrics = {
        "category_accuracy": sum(1 if r["single_assistant"]["category_correct"] else 0 for r in results) / len(results),
        "urgency_accuracy": sum(1 if r["single_assistant"]["urgency_correct"] else 0 for r in results) / len(results),
        "location_accuracy": sum(1 if r["single_assistant"]["location_correct"] else 0 for r in results) / len(results),
        "people_accuracy": sum(1 if r["single_assistant"]["people_correct"] else 0 for r in results) / len(results),
        "avg_needs_count": sum(r["single_assistant"]["needs_count"] for r in results) / len(results),
        "avg_completeness": sum(r["single_assistant"]["completeness"] for r in results) / len(results),
        "avg_confidence": sum(r["single_assistant"]["confidence"] for r in results) / len(results),
        "avg_processing_time": sum(r["single_assistant"]["processing_time"] for r in results) / len(results),
        "human_review_rate": sum(1 if r["single_assistant"]["requires_human_review"] else 0 for r in results) / len(results)
    }
    
    multi_metrics = {
        "category_accuracy": sum(1 if r["multi_agent"]["category_correct"] else 0 for r in results) / len(results),
        "urgency_accuracy": sum(1 if r["multi_agent"]["urgency_correct"] else 0 for r in results) / len(results),
        "location_accuracy": sum(1 if r["multi_agent"]["location_correct"] else 0 for r in results) / len(results),
        "people_accuracy": sum(1 if r["multi_agent"]["people_correct"] else 0 for r in results) / len(results),
        "avg_needs_count": sum(r["multi_agent"]["needs_count"] for r in results) / len(results),
        "avg_completeness": sum(r["multi_agent"]["completeness"] for r in results) / len(results),
        "avg_confidence": sum(r["multi_agent"]["confidence"] for r in results) / len(results),
        "avg_processing_time": sum(r["multi_agent"]["processing_time"] for r in results) / len(results),
        "human_review_rate": sum(1 if r["multi_agent"]["requires_human_review"] else 0 for r in results) / len(results)
    }
    
    # Print summary statistics
    print("\n=== OVERALL COMPARISON ===\n")
    print(f"Total test cases: {len(test_cases)}")
    print()
    print(f"Single Assistant:")
    print(f"  • Category Accuracy: {single_metrics['category_accuracy']:.2f}")
    print(f"  • Urgency Accuracy: {single_metrics['urgency_accuracy']:.2f}")
    print(f"  • Location Accuracy: {single_metrics['location_accuracy']:.2f}")
    print(f"  • People Count Accuracy: {single_metrics['people_accuracy']:.2f}")
    print(f"  • Avg. Needs Identified: {single_metrics['avg_needs_count']:.2f}")
    print(f"  • Avg. Completeness: {single_metrics['avg_completeness']:.2f}")
    print(f"  • Avg. Confidence: {single_metrics['avg_confidence']:.2f}")
    print(f"  • Avg. Processing Time: {single_metrics['avg_processing_time']:.2f}s")
    print(f"  • Human Review Rate: {single_metrics['human_review_rate']:.2f}")
    
    print(f"\nMulti-Agent System:")
    print(f"  • Category Accuracy: {multi_metrics['category_accuracy']:.2f}")
    print(f"  • Urgency Accuracy: {multi_metrics['urgency_accuracy']:.2f}")
    print(f"  • Location Accuracy: {multi_metrics['location_accuracy']:.2f}")
    print(f"  • People Count Accuracy: {multi_metrics['people_accuracy']:.2f}")
    print(f"  • Avg. Needs Identified: {multi_metrics['avg_needs_count']:.2f}")
    print(f"  • Avg. Completeness: {multi_metrics['avg_completeness']:.2f}")
    print(f"  • Avg. Confidence: {multi_metrics['avg_confidence']:.2f}")
    print(f"  • Avg. Processing Time: {multi_metrics['avg_processing_time']:.2f}s")
    print(f"  • Human Review Rate: {multi_metrics['human_review_rate']:.2f}")
    
    # Create visualizations
    create_comparison_charts(single_metrics, multi_metrics, results)
    
    return results, single_metrics, multi_metrics

def create_comparison_charts(single_metrics, multi_metrics, results):
    """Create visualizations comparing the approaches."""
    # Set up the figure for accuracy metrics
    fig, ax1 = plt.subplots(figsize=(14, 7))
    
    # Data for accuracy comparison
    metrics = ['Category', 'Urgency', 'Location', 'People\nCount', 'Completeness']
    single_values = [
        single_metrics["category_accuracy"],
        single_metrics["urgency_accuracy"],
        single_metrics["location_accuracy"],
        single_metrics["people_accuracy"],
        single_metrics["avg_completeness"]
    ]
    multi_values = [
        multi_metrics["category_accuracy"],
        multi_metrics["urgency_accuracy"],
        multi_metrics["location_accuracy"],
        multi_metrics["people_accuracy"],
        multi_metrics["avg_completeness"]
    ]
    
    # Plot accuracy metrics
    x = range(len(metrics))
    width = 0.35
    
    ax1.bar([i - width/2 for i in x], single_values, width, label='Single Assistant')
    ax1.bar([i + width/2 for i in x], multi_values, width, label='Multi-Agent')
    
    ax1.set_ylabel('Score (0-1)')
    ax1.set_title('Accuracy Metrics Comparison')
    ax1.set_xticks(x)
    ax1.set_xticklabels(metrics)
    ax1.legend()
    ax1.set_ylim(0, 1)
    
    # Add percentage labels
    for i, v in enumerate(single_values):
        ax1.text(i - width/2, v + 0.02, f'{v:.0%}', ha='center')
    
    for i, v in enumerate(multi_values):
        ax1.text(i + width/2, v + 0.02, f'{v:.0%}', ha='center')
    
    plt.tight_layout()
    plt.savefig('accuracy_comparison.png')
    plt.close()
    
    # Create a second figure for other metrics
    fig2, ax2 = plt.subplots(figsize=(14, 7))
    
    # Data for other metrics
    metrics2 = ['Needs\nIdentified', 'Confidence', 'Human\nReview Rate', 'Processing\nTime (s)']
    single_values2 = [
        single_metrics["avg_needs_count"] / 5,  # Normalize to 0-1 range (assuming max 5 needs)
        single_metrics["avg_confidence"],
        single_metrics["human_review_rate"],
        single_metrics["avg_processing_time"] / max(single_metrics["avg_processing_time"], multi_metrics["avg_processing_time"])
    ]
    multi_values2 = [
        multi_metrics["avg_needs_count"] / 5,  # Normalize to 0-1 range (assuming max 5 needs)
        multi_metrics["avg_confidence"],
        multi_metrics["human_review_rate"],
        multi_metrics["avg_processing_time"] / max(single_metrics["avg_processing_time"], multi_metrics["avg_processing_time"])
    ]
    
    # Plot other metrics
    x2 = range(len(metrics2))
    
    ax2.bar([i - width/2 for i in x2], single_values2, width, label='Single Assistant')
    ax2.bar([i + width/2 for i in x2], multi_values2, width, label='Multi-Agent')
    
    ax2.set_ylabel('Normalized Score (0-1)')
    ax2.set_title('Other Metrics Comparison')
    ax2.set_xticks(x2)
    ax2.set_xticklabels(metrics2)
    ax2.legend()
    
    # Add actual value labels
    ax2.text(0 - width/2, single_values2[0] + 0.02, f'{single_metrics["avg_needs_count"]:.1f}', ha='center')
    ax2.text(0 + width/2, multi_values2[0] + 0.02, f'{multi_metrics["avg_needs_count"]:.1f}', ha='center')
    ax2.text(1 - width/2, single_values2[1] + 0.02, f'{single_metrics["avg_confidence"]:.2f}', ha='center')
    ax2.text(1 + width/2, multi_values2[1] + 0.02, f'{multi_metrics["avg_confidence"]:.2f}', ha='center')
    ax2.text(2 - width/2, single_values2[2] + 0.02, f'{single_metrics["human_review_rate"]:.0%}', ha='center')
    ax2.text(2 + width/2, multi_values2[2] + 0.02, f'{multi_metrics["human_review_rate"]:.0%}', ha='center')
    ax2.text(3 - width/2, single_values2[3] + 0.02, f'{single_metrics["avg_processing_time"]:.1f}s', ha='center')
    ax2.text(3 + width/2, multi_values2[3] + 0.02, f'{multi_metrics["avg_processing_time"]:.1f}s', ha='center')
    
    plt.tight_layout()
    plt.savefig('other_metrics_comparison.png')
    plt.close()
    
    print("Comparison charts saved as 'accuracy_comparison.png' and 'other_metrics_comparison.png'")

if __name__ == "__main__":
    asyncio.run(compare_approaches())