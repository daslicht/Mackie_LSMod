// MCU Script
// Copyright (c)2013 PreSonus Software Ltd.

// include SDK files from host
include_file ("resource://com.presonus.musicdevices/sdk/controlsurfacecomponent.js")

include_file ("MackieShared.js");

//////////////////////////////////////////////////////////////////////////////////////////////////
// Definitions
//////////////////////////////////////////////////////////////////////////////////////////////////

const theBankNames = 
[
	"AllBank",			// Global View
	"Type:AudioInput",	// Inputs
	"Type:AudioTrack",	// Audio Tracks
	"Type:AudioSynth",	// Audio Intrument
	"Type:AudioEffect",	// Aux
	"Type:AudioGroup",	// Bus
	"Type:AudioOutput",	// Outputs
	"Type:AudioVCA",	// VCA
	"RemoteBank"		// User
];

//////////////////////////////////////////////////////////////////////////////////////////////////
// MackieControlHandler
//////////////////////////////////////////////////////////////////////////////////////////////////

MackieControlHandler.prototype = new BasicMackieHandler ();
function MackieControlHandler ()
{	
	this.onInit = function (surface)
	{		
		BasicMackieHandler.prototype.onInit.call (this, surface);
						
		let paramList = surface.paramList;

		// mode parameters
		this.assignMode = paramList.addInteger (0, kLastMode, "assignMode");
		this.assignString = paramList.addString ("assignString");
		this.sendMode = paramList.addParam ("sendMode");
		this.flipMode = paramList.addParam ("flipMode");
		this.nameValueMode = paramList.addParam ("nameValueMode");
		
		this.updateModeParams ();

		// add parameter for bank selection
		this.bankList = paramList.addList ("bankList");
		for(let i in theBankNames)		
			this.bankList.appendString (theBankNames[i]);
	}
	
	this.updateModeParams = function ()
	{
		this.assignMode.value = this.assignment.mode;
		this.assignString.string = this.assignment.getModeString ();	
		this.flipMode.value = this.assignment.flipActive;
		this.nameValueMode.value = this.assignment.nameValueMode;
	}

	this.getMaxSendSlotCount = function ()
	{
		let mixerConsole = this.mixerMapping.component;

		if(mixerConsole)
			return mixerConsole.audioMixer.getMaxSlotCount (PreSonus.FolderID.kSendsFolder);
		else
			return kNumChannels;
	}
	
	this.syncGroupAssignment = function ()
	{
		let groupId = this.rootElement.getPlacementGroup ();
		if(groupId != 0)
			Host.Signals.signal (kMCUSignal, kAssignmentChanged, groupId, this.assignment);
	}
	
	this.onSyncAssignment = function (otherAssignment)
	{
		BasicMackieHandler.prototype.onSyncAssignment.call (this, otherAssignment);
	
		this.updateModeParams ();
	}
	
	this.paramChanged = function (param)
	{
		if(param == this.sendMode) // "Send" button pressed
		{			
			this.assignment.navigateSends (this.getMaxSendSlotCount ());
			
			this.updateModeParams ();
			this.updateAll ();
			this.syncGroupAssignment ();
		}	
		else if(param == this.assignMode)
		{
			this.assignment.mode = this.assignMode.value;
			
			this.updateModeParams ();
			this.updateAll ();			
			this.syncGroupAssignment ();
		}		
		else if(param == this.flipMode)
		{
			this.assignment.flipActive = this.flipMode.value;
			
			this.updateAll ();			
			this.syncGroupAssignment ();
		}
		else if(param == this.nameValueMode)
		{
			this.assignment.nameValueMode = this.nameValueMode.value;

			this.updateAll ();			
			this.syncGroupAssignment ();
		}
		else if(param == this.bankList)
		{
			// switch bank target
			this.channelBankElement.selectBank (this.bankList.string);
		}
	}
}

function createInstance ()
{
	return new MackieControlHandler;
}