// This script helps debug the Actions functionality

$(document).ready(function() {
  console.log("Debug-Actions script loaded");
  
  // Check if the content selection modal exists
  const modalExists = $('#contentSelectionModal').length > 0;
  console.log("Content selection modal exists:", modalExists);
  
  // Check if action buttons exist
  console.log("selectContentBtn exists:", $('#selectContentBtn').length > 0);
  console.log("runActionBtn exists:", $('#runActionBtn').length > 0);
  
  // Add backup event handlers for the buttons
  $('#selectContentBtn').on('click', function() {
    console.log("Select content button clicked (backup handler)");
    if (!selectedActionId) {
      alert("Please select an action first");
      return;
    }
    
    // Show the modal directly if it exists
    if (modalExists) {
      $('#contentSelectionModal').modal('show');
    } else {
      alert("Content selection modal not found in the document!");
    }
  });
  
  $('#runActionBtn').on('click', function() {
    console.log("Run action button clicked (backup handler)");
    if (!selectedActionId) {
      alert("Please select an action first");
      return;
    }
    
    alert("Running action with ID: " + selectedActionId);
  });
  
  // Check if modal is properly configured
  if (modalExists) {
    $('#contentSelectionModal').on('shown.bs.modal', function() {
      console.log("Modal shown successfully");
    });
    
    // Add direct handler to confirmation button
    $('#confirmContentSelection').on('click', function() {
      console.log("Confirmation button clicked directly");
      // Close the modal
      $('#contentSelectionModal').modal('hide');
      $('#runActionBtn').addClass("btn-success").removeClass("btn-primary").text("Run Action with Selected Content");
    });
  }
});
